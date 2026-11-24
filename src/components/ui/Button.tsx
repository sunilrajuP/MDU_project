import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.scss';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
}

export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return <button className={[styles.button, styles[variant], className].filter(Boolean).join(' ')} {...rest} />;
}
