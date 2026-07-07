import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  children, 
  className = '', 
  ...props 
}) => {
  const baseStyles = 'px-6 py-3.5 rounded-xl font-medium tracking-wide text-sm transition-all duration-200 outline-hidden flex items-center justify-center gap-2 w-full';
  
  const variants = {
    primary: 'bg-[#5C0632] hover:bg-[#3B0019] text-white active:bg-[#23000E] shadow-sm',
    secondary: 'bg-[#EADEC9]/30 hover:bg-[#EADEC9]/50 text-[#5C0632] active:bg-[#EADEC9]/70',
    outline: 'border border-[#C3AD86] hover:bg-[#F7F3EB]/40 text-[#44403C] active:bg-[#F7F3EB]/80'
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};
