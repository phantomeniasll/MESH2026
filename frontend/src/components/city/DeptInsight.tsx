interface DeptInsightProps {
  dept: string;
  question: string;
  answer: string;
  accent?: "noise" | "activity" | "heat" | "default";
}

export function DeptInsight({ dept, question, answer }: DeptInsightProps) {
  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid var(--cc-border)", borderBottom: "1px solid var(--cc-border)" }}>
      <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cc-muted)", marginBottom: "6px" }}>
        {dept} — Analytical note
      </p>
      <p style={{ fontSize: "12px", color: "var(--cc-muted)", lineHeight: 1.5, marginBottom: "4px" }}>
        {question}
      </p>
      <p style={{ fontSize: "13px", color: "var(--cc-text)", lineHeight: 1.6 }}>
        {answer}
      </p>
    </div>
  );
}
