import { LineResult } from "@/lib/engine";

interface ResultLineProps {
  result: LineResult;
}

export default function ResultLine({ result }: ResultLineProps) {
  if (!result.display) {
    return <div className="h-[1.5rem]">&nbsp;</div>;
  }

  return (
    <div
      className={`h-[1.5rem] text-right truncate ${
        result.isAssignment ? "text-accent-dim" : "text-accent"
      }`}
    >
      {result.display}
    </div>
  );
}
