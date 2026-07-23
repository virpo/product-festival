type StripesProps = {
  size?: "sm" | "md";
};

export function Stripes({ size = "md" }: StripesProps) {
  return (
    <span
      className={`stripes ${size === "sm" ? "stripes--sm" : ""}`}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </span>
  );
}
