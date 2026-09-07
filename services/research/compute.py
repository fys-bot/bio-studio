"""Runs in a separate, killable process. No user-supplied code or formulas are evaluated."""
import json
import math
import sys
from pathlib import Path


def run(config, output):
    import importlib.metadata
    import numpy as np
    import pandas as pd
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from pydeseq2.dds import DeseqDataSet
    from pydeseq2.ds import DeseqStats
    from pydeseq2.default_inference import DefaultInference
    def read(path):
        path = Path(path)
        return pd.read_excel(path, index_col=0) if path.suffix == ".xlsx" else pd.read_csv(path, sep="\t" if path.suffix == ".tsv" else ",", index_col=0)
    counts = read(config["countsPath"]).T
    metadata = read(config["metadataPath"])
    if counts.index.has_duplicates or counts.columns.has_duplicates or metadata.index.has_duplicates:
        raise ValueError("Duplicate sample or gene identifiers")
    if set(counts.index) != set(metadata.index):
        raise ValueError("Count matrix sample columns must exactly match metadata sample IDs")
    metadata = metadata.loc[counts.index]
    if counts.shape[0] > 512 or counts.shape[1] > 100_000:
        raise ValueError("Compute input exceeds limits")
    values = counts.to_numpy(dtype=float)
    if not np.isfinite(values).all() or (values < 0).any() or not np.equal(values, np.floor(values)).all():
        raise ValueError("DESeq2 requires non-negative integer raw counts, not TPM/FPKM")
    counts = counts.astype(int)
    factor = config["condition"]
    factors = [factor] + ([config["batch"]] if config.get("batch") else [])
    if any(key not in metadata.columns for key in factors):
        raise ValueError("Missing design factor in metadata")
    if metadata[factors].isna().any().any():
        raise ValueError("Design factors contain missing values")
    metadata[factor] = metadata[factor].astype(str)
    if set(metadata[factor]) != {config["control"], config["treated"]}:
        raise ValueError("This worker expects exactly the two selected groups")
    if (metadata[factor].value_counts() < 2).any():
        raise ValueError("Each group requires at least two biological replicates")
    total_genes = counts.shape[1]
    counts = counts.loc[:, counts.sum(axis=0) >= 10]
    if counts.shape[1] < 10:
        raise ValueError("At least 10 non-low-count genes are required for dispersion fitting")
    design = "~ " + " + ".join(factors)
    inference = DefaultInference(n_cpus=1)
    dds = DeseqDataSet(counts=counts, metadata=metadata, design=design, refit_cooks=True, inference=inference)
    dds.deseq2()
    stats = DeseqStats(dds, contrast=[factor, config["treated"], config["control"]], alpha=config["alpha"], inference=inference)
    stats.summary()
    result = stats.results_df
    result.index.name = "gene"
    result.to_csv(output / "results.csv")
    valid = result.dropna(subset=["padj", "log2FoldChange"])
    significant = valid[valid.padj < config["alpha"]]
    top = valid.sort_values("padj").head(20)
    fig, ax = plt.subplots(figsize=(7, 4.5), facecolor="white")
    colors = np.where(valid.padj < config["alpha"], "#087f8c", "#b5bcb8")
    ax.scatter(valid.log2FoldChange, -np.log10(valid.padj.clip(lower=1e-300)), c=colors, s=10, alpha=.8)
    ax.axhline(-np.log10(config["alpha"]), linestyle="--", color="#bb6f36", linewidth=.8)
    ax.set(xlabel="log2 fold change", ylabel="-log10 adjusted p-value", title="PyDESeq2: treated vs control")
    fig.tight_layout()
    fig.savefig(output / "volcano.png", dpi=160)
    plt.close(fig)
    summary = {"testedGeneCount": len(result), "significantGeneCount": len(significant), "candidateGeneCount": len(top)}
    version = importlib.metadata.version("pydeseq2")
    candidates = [{"symbol": str(gene), "fdr": float(row.padj), "log2FoldChange": float(row.log2FoldChange),
                   "direction": "up" if row.log2FoldChange >= 0 else "down"}
                  for gene, row in top.iterrows()]
    (output / "report.md").write_text(f"# Differential expression analysis\n\nEngine: PyDESeq2 {version}\n\nDesign: `{design}`\n\nSamples: {len(counts)}\n\nInput genes: {total_genes}\n\nTested genes: {len(result)}\n\nSignificant genes (padj < {config['alpha']}): {len(significant)}\n\nContrast: {config['treated']} versus {config['control']}\n\nLow-count filter: total count >= 10. Wald test; adjusted p-values from PyDESeq2. No synthetic statistics substituted.\n\nPyDESeq2 is a Python reimplementation, not a byte-identical R DESeq2 run.\n")
    (output / "analysis.py").write_text(Path(__file__).read_text())
    (output / "result.json").write_text(json.dumps({"engine": "PyDESeq2", "version": version, "design": design,
        "summary": summary, "sampleCount": len(counts), "candidateGenes": candidates,
        "artifacts": ["results.csv", "volcano.png", "report.md", "analysis.py"]}, allow_nan=False))


if __name__ == "__main__":
    output = Path(sys.argv[2])
    try:
        run(json.loads(Path(sys.argv[1]).read_text()), output)
    except Exception as error:
        (output / "error.json").write_text(json.dumps({"error": str(error)}))
        raise
