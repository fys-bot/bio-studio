import type { ReactNode } from "react";

const tokenPattern = /(#.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:assert|as|def|else|for|from|if|import|in|return)\b|\b\d+(?:\.\d+)?\b)/g;
const highlightedTokenPattern = /^(#.*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(?:assert|as|def|else|for|from|if|import|in|return)|\d+(?:\.\d+)?)$/;

function classifyToken(token: string) {
  if (token.startsWith("#")) return "comment";
  if (token.startsWith('"') || token.startsWith("'")) return "string";
  if (/^\d/.test(token)) return "number";
  return "keyword";
}

function highlightLine(line: string): ReactNode[] {
  return line.split(tokenPattern).filter(Boolean).map((token, tokenIndex) =>
    highlightedTokenPattern.test(token) ? (
      <span className={`code-token ${classifyToken(token)}`} key={`${token}-${tokenIndex}`}>
        {token}
      </span>
    ) : (
      <span key={`${token}-${tokenIndex}`}>{token}</span>
    ),
  );
}

type PythonCodeBlockProps = {
  code: string;
  streaming: boolean;
};

/** 无 HTML 注入的 Python 轻量高亮器，保留流式文本的每一行和空白。 */
export function PythonCodeBlock({ code, streaming }: PythonCodeBlockProps) {
  const lines = code.split("\n");
  return (
    <div className="python-code-block" aria-label="Python 分析代码">
      {lines.map((line, lineIndex) => (
        <div className="python-code-line" key={lineIndex}>
          <span className="code-line-number" aria-hidden="true">
            {lineIndex + 1}
          </span>
          <code>
            {highlightLine(line)}
            {streaming && lineIndex === lines.length - 1 && (
              <span className="streaming-cursor" aria-label="正在生成" />
            )}
          </code>
        </div>
      ))}
    </div>
  );
}
