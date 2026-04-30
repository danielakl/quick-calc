import { LineResult } from "@/lib/engine";

interface ResultLineProps {
  result: LineResult;
}

export default function ResultLine({ result }: ResultLineProps) {
  if (result.error) {
    return <div className="h-6 truncate text-right text-error">{result.error}</div>;
  }

  if (!result.display) {
    return <div className="h-6">&nbsp;</div>;
  }

  return (
    <div
      className={`h-6 truncate text-right ${
        result.isAssignment ? "text-accent-dim" : "text-accent"
      }`}
    >
      {result.display}
    </div>
  );
}
