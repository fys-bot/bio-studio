/** 从 PDB/mmCIF 解析器得到的单个主链原子点。 */
export type StructurePoint = {
  residueNumber: number;
  aminoAcid: string;
  x: number;
  y: number;
  z: number;
  confidence: number;
};

/** 结构点投影到 Canvas 后的屏幕坐标。 */
export type ProjectedStructurePoint = StructurePoint & {
  screenX: number;
  screenY: number;
  depth: number;
};

export type StructureMetadata = {
  accession: string;
  name: string;
  confidence: string;
};

const aminoAcids = ["ALA", "GLY", "SER", "LEU", "VAL", "ARG", "ASP", "TYR"];

const structureCatalog: Record<string, StructureMetadata> = {
  E2F1: { accession: "AF-Q01094-F1", name: "转录因子 E2F1", confidence: "86.4" },
  CCNE2: { accession: "AF-O96020-F1", name: "细胞周期蛋白 E2", confidence: "89.1" },
  CDK1: { accession: "AF-P06493-F1", name: "细胞分裂周期蛋白 1", confidence: "95.7" },
  GADD45A: { accession: "AF-P24522-F1", name: "生长停滞与 DNA 损伤蛋白", confidence: "88.8" },
  MKI67: { accession: "AF-P46013-F1", name: "增殖标志蛋白 Ki-67", confidence: "72.6" },
};

/** 生成确定性的主链三维坐标，模拟从 PDB/mmCIF 解析后的 Cα 原子集合。 */
function createStructurePoints(): StructurePoint[] {
  return Array.from({ length: 72 }, (_, pointIndex) => {
    const helixAngle = pointIndex * 0.55;
    const domainCurve = Math.sin(pointIndex * 0.17) * 1.25;
    return {
      residueNumber: 104 + pointIndex,
      aminoAcid: aminoAcids[pointIndex % aminoAcids.length],
      x: Math.cos(helixAngle) * 1.35 + domainCurve,
      y: (pointIndex - 36) * 0.13,
      z: Math.sin(helixAngle) * 1.35 + Math.cos(pointIndex * 0.11) * 0.8,
      confidence: 72 + ((pointIndex * 17) % 27),
    };
  });
}

export const structurePoints = createStructurePoints();
export const functionalResidues = new Set([120, 141, 159, 171]);

export function getStructureMetadata(geneSymbol?: string): StructureMetadata {
  return structureCatalog[geneSymbol || "E2F1"] || structureCatalog.E2F1;
}
