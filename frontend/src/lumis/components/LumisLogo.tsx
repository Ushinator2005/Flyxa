type LumisLogoProps = {
  className?: string;
};

export default function LumisLogo({ className = '' }: LumisLogoProps) {
  return <span className={`lumis-logo ${className}`.trim()}>Flyxa</span>;
}
