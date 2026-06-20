import { ChevronDown, CloudUpload } from "lucide-react";
import { AiProviderLogo } from "@/components/ai/AiProviderLogo";

export type SetupVisualVariant = "model" | "resume" | "smtp";

export function SetupStepVisual({ variant }: { variant: SetupVisualVariant }) {
  if (variant === "resume") return <ResumeVisual />;
  if (variant === "smtp") return <SmtpVisual />;
  return <ModelVisual />;
}

function ModelVisual() {
  return (
    <div className="m-setup-visual" aria-hidden>
      <p className="m-setup-visual-title">Choose Model</p>

      <div className="m-setup-visual-field">
        <span className="m-setup-visual-label">Model provider</span>
        <div className="m-setup-visual-input m-setup-visual-select">
          <span className="m-setup-visual-select-value">
            <AiProviderLogo provider="openai" className="h-3.5 w-3.5" />
            OpenAI
          </span>
          <ChevronDown className="m-setup-visual-chevron" />
        </div>
      </div>

      <div className="m-setup-visual-field">
        <span className="m-setup-visual-label">Model</span>
        <div className="m-setup-visual-input is-placeholder">Select model</div>
      </div>

      <div className="m-setup-visual-field">
        <span className="m-setup-visual-label">API key</span>
        <div className="m-setup-visual-input is-placeholder">Paste your API key</div>
      </div>

      <div className="m-setup-visual-btn">Save &amp; verify</div>
    </div>
  );
}

function ResumeVisual() {
  return (
    <div className="m-setup-visual m-setup-visual--resume" aria-hidden>
      <div className="m-setup-visual-dropzone">
        <span className="m-setup-visual-dropzone-icon">
          <CloudUpload aria-hidden />
        </span>
        <p className="m-setup-visual-dropzone-title">Choose a file or drag &amp; drop it here</p>
        <p className="m-setup-visual-dropzone-hint">PDF format</p>
        <span className="m-setup-visual-dropzone-btn">Browse file</span>
      </div>
    </div>
  );
}

function SmtpVisual() {
  return (
    <div className="m-setup-visual" aria-hidden>
      <p className="m-setup-visual-title">Connect Gmail</p>

      <div className="m-setup-visual-field">
        <span className="m-setup-visual-label">Gmail address</span>
        <div className="m-setup-visual-input">you@gmail.com</div>
      </div>

      <div className="m-setup-visual-field">
        <span className="m-setup-visual-label">App password</span>
        <div className="m-setup-visual-input is-masked">xxxx xxxx xxxx xxxx</div>
      </div>

      <div className="m-setup-visual-btn is-primary">Connect Gmail</div>
    </div>
  );
}
