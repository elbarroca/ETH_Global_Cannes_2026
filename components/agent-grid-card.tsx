import { Card, CardHeader, CardBody, CodeBlock } from "@/components/ui/card";
import { SealedBadge } from "@/components/ui/badge";

export function AgentGridCard({
  emoji,
  title,
  borderColor,
  message,
  recommendation,
  attestation,
  sealed,
}: {
  emoji: string;
  title: string;
  borderColor: string;
  message: string;
  recommendation: string;
  attestation: string;
  sealed: boolean;
}) {
  return (
    <Card className={`border-l-2 ${borderColor}`}>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
          <span>{emoji}</span>
          <span>{title}</span>
        </div>
        {sealed && <SealedBadge />}
      </CardHeader>
      <CardBody className="space-y-3">
        <CodeBlock className="streaming-text">
          {message}
        </CodeBlock>
        {recommendation && (
          <p className="text-sm font-semibold text-void-200">{recommendation}</p>
        )}
        {attestation && (
          <p className="text-xs font-mono text-void-600 truncate">
            Attestation: {attestation}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
