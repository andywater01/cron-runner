import clsx from "clsx";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

export interface CodeBlockProps {
  code: string;
  /** Scrollable max height, e.g. "max-h-64". Omit to grow with content. */
  maxHeight?: string;
  wrap?: boolean;
  className?: string;
  /** Hide the copy button (e.g. for very short inline snippets). */
  noCopy?: boolean;
}

export function CodeBlock({ code, maxHeight, wrap = true, className, noCopy }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; failing silently is fine here.
    }
  }

  return (
    <div
      className={clsx(
        "group relative rounded-lg border border-default bg-surface-muted",
        className,
      )}
    >
      <pre
        className={clsx(
          "overflow-auto px-3.5 py-3 font-mono text-[13px] leading-relaxed text-default",
          wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
          maxHeight,
        )}
      >
        {code || " "}
      </pre>
      {!noCopy && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          onClick={copy}
          className="absolute top-1.5 right-1.5 bg-surface/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          icon={
            copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />
          }
        />
      )}
    </div>
  );
}
