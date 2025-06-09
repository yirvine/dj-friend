import React from 'react';

// A basic Button component that accepts variant, size, and className props like shadcn/ui
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'ghost';
    size?: 'sm' | 'icon';
  }
>(({ className, variant, size, ...props }, ref) => {
  // Basic styling to make it functional and visible.
  // This can be expanded later.
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

  const variantClasses = {
    ghost: "hover:bg-accent hover:text-accent-foreground",
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
  };

  const sizeClasses = {
    sm: "h-9 rounded-md px-3",
    icon: "h-10 w-10",
    default: "h-10 px-4 py-2",
  };

  const appliedVariant = variant || 'default';
  const appliedSize = size || 'default';

  return (
    <button
      className={`${baseClasses} ${variantClasses[appliedVariant]} ${sizeClasses[appliedSize]} ${className}`}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button }; 