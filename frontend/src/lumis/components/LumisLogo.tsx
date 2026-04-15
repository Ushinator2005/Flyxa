import FlyxaLogo from '../../components/common/FlyxaLogo.js';

type LumisLogoProps = {
  className?: string;
};

export default function LumisLogo({ className = '' }: LumisLogoProps) {
  return <FlyxaLogo size={40} showWordmark wordmarkClassName={className} />;
}
