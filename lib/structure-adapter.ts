import type { StructureAdapterState } from "@/lib/domain";
import type { StructureAdapter } from "@/lib/adapters";
import { structurePoints, type StructurePoint } from "@/lib/structure-model";

const pdbFixture = `HEADER    BIOFLOW DEMO STRUCTURE
TITLE     DETERMINISTIC STRUCTURE ADAPTER FIXTURE
ATOM      1  CA  ALA A 104       0.000   0.000   1.350  1.00 72.00           C
ATOM      2  CA  GLY A 105       0.890   0.130   1.020  1.00 89.00           C
ATOM      3  CA  SER A 106       1.150   0.260   0.240  1.00 79.00           C
ATOM      4  CA  LEU A 107       0.660   0.390  -0.720  1.00 96.00           C
ATOM      5  CA  VAL A 108      -0.270   0.520  -1.210  1.00 84.00           C
ATOM      6  CA  ARG A 109      -1.080   0.650  -0.650  1.00 73.00           C
ATOM      7  CA  ASP A 110      -1.240   0.780   0.320  1.00 91.00           C
ATOM      8  CA  TYR A 111      -0.550   0.910   1.160  1.00 88.00           C
ATOM      9  CA  ALA A 112       0.420   1.040   1.180  1.00 75.00           C
ATOM     10  CA  GLY A 113       1.130   1.170   0.390  1.00 93.00           C
ATOM     11  CA  SER A 114       0.990   1.300  -0.590  1.00 86.00           C
ATOM     12  CA  LEU A 115       0.100   1.430  -1.220  1.00 81.00           C
ATOM     13  CA  VAL A 116      -0.830   1.560  -0.800  1.00 90.00           C
ATOM     14  CA  ARG A 117      -1.260   1.690   0.090  1.00 78.00           C
ATOM     15  CA  ASP A 118      -0.780   1.820   0.950  1.00 94.00           C
ATOM     16  CA  TYR A 119       0.160   1.950   1.240  1.00 87.00           C
ATOM     17  CA  ALA A 120       1.000   2.080   0.730  1.00 97.00           C
ATOM     18  CA  GLY A 121       1.210   2.210  -0.210  1.00 83.00           C
END
`;

function parsePdb(text: string): StructurePoint[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("ATOM") && line.slice(12, 16).trim() === "CA")
    .map((line, index) => ({
      residueNumber: Number.parseInt(line.slice(22, 26).trim(), 10),
      aminoAcid: line.slice(17, 20).trim(),
      x: Number.parseFloat(line.slice(30, 38)),
      y: Number.parseFloat(line.slice(38, 46)),
      z: Number.parseFloat(line.slice(46, 54)),
      confidence: Number.parseFloat(line.slice(60, 66)) || 72 + (index % 20),
    }));
}

export const demoStructureAdapter: StructureAdapter = {
  async load({ accession, format }) {
    const points = format === "pdb" ? parsePdb(pdbFixture) : structurePoints;
    return {
      state: {
        source: format === "pdb" ? "pdb" : "cif",
        status: format === "pdb" ? "ready" : "fallback",
        accession,
        fileName: `${accession}.${format}`,
        message:
          format === "pdb"
            ? "已加载 BioFlow PDB 结构适配器示例文件"
            : "CIF 解析器未启用，已回退到轻量 Canvas 结构点",
      },
      points,
    };
  },
};

export { parsePdb };
