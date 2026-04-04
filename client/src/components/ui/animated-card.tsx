import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AnimatedCardProps {
    children: ReactNode;
    className?: string;
    containerClassName?: string;
    innerClassName?: string;
    onClick?: () => void;
    highlighted?: boolean;
}

/**
 * Animated card with background overlay effect on hover (dark mode only)
 */
export function AnimatedCard({
    children,
    className,
    containerClassName,
    innerClassName,
    onClick,
    highlighted = false,
}: AnimatedCardProps) {
    return (
        <div
            className={cn(
                "group relative rounded-2xl transition-all duration-300",
                onClick && "cursor-pointer",
                highlighted && "shadow-[0_24px_52px_-40px_rgba(59,99,204,0.11)] dark:shadow-[0_24px_52px_-40px_rgba(96,124,255,0.18)]",
                containerClassName
            )}
            onClick={onClick}
        >
            <div
                className={cn(
                    "relative h-full transition-all duration-300"
                )}
            >
                <div
                    className={cn(
                        "relative overflow-hidden rounded-[22px] border border-[#D0DFFF] bg-white transition-all duration-300 dark:border-border dark:bg-card",
                        highlighted &&
                            "task-unread-border rounded-2xl border-[#CEDBFF]/50 bg-white dark:border-[#5E7AE8]/50 dark:bg-card",
                        innerClassName
                    )}
                >
                    <div className={cn("relative z-10", className)}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Card with glow effect on hover (dark mode only)
 */
export function GlowCard({
    children,
    className,
    containerClassName,
    onClick
}: AnimatedCardProps) {
    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl",
                containerClassName
            )}
            onClick={onClick}
        >
            {/* Glow effect - Dark mode only */}
            <div className="absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-500 dark:bg-gradient-to-br dark:from-primary/20 dark:via-transparent dark:to-accent/20 dark:group-hover:opacity-100" />

            {/* Card */}
            <div className={cn(
                "relative rounded-2xl border border-[#D9E6FF] dark:border-border bg-white dark:bg-card transition-all duration-300",
                "dark:group-hover:border-primary/50 dark:group-hover:shadow-lg dark:group-hover:shadow-primary/10",
                onClick && "cursor-pointer",
                className
            )}>
                {children}
            </div>
        </div>
    );
}

/**
 * Feature card with animated border on hover (dark mode only)
 */
export function FeatureCard({
    children,
    className,
    containerClassName,
    onClick
}: AnimatedCardProps) {
    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl",
                containerClassName
            )}
            onClick={onClick}
        >
            {/* Card content */}
            <div className={cn(
                "relative rounded-2xl bg-white dark:bg-card border border-[#D9E6FF] dark:border-border transition-all duration-300 dark:transition-none",
                onClick && "cursor-pointer",
                className
            )}>
                {children}
            </div>
        </div>
    );
}
