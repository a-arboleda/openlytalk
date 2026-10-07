const steps = [
  { label: "Notice", icon: "◉", detail: "See one choice." },
  { label: "Shape", icon: "◇", detail: "Give it direction." },
  { label: "Speak", icon: "◌", detail: "Say what you mean." },
  { label: "Reflect", icon: "✦", detail: "Try one adjustment." },
];

export function MethodStrip() {
  return (
    <div className="method-strip">
      {steps.map((step) => (
        <div key={step.label} className="method-step">
          <span className="method-icon" aria-hidden="true">{step.icon}</span>
          <span>
            <strong className="font-editorial text-xl font-normal text-ink">{step.label}</strong>
            <small>{step.detail}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
