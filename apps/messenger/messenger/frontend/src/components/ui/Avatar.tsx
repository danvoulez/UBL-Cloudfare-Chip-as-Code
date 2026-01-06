import React from 'react';
import { cn } from '../../lib/cn';
import { User, Bot, Shield } from 'lucide-react';

export interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  type?: 'human' | 'agent' | 'system';
  online?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  size = 'md',
  type = 'human',
  online,
  className,
}) => {
  const sizes = {
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
    xl: 'avatar-xl',
  };

  const IconComponent = {
    human: User,
    agent: Bot,
    system: Shield,
  }[type];

  return (
    <div className={cn('avatar relative', sizes[size], type === 'agent' && 'avatar-agent', className)}>
      {src ? (
        <img src={src} alt={alt} />
      ) : (
        <IconComponent className="w-1/2 h-1/2" />
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border border-bg-base" />
      )}
    </div>
  );
};

