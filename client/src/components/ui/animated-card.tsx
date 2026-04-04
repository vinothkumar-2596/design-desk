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
                highlighted && "shadow-[0_18px_48px_-36px_rgba(59,99,204,0.46)] dark:shadow-[0_22px_56px_-36px_rgba(96,124,255,0.35)]",
                containerClassName
            )}
            onClick={onClick}
        >
            {highlighted && (
                <div className="pointer-events-none absolute -inset-3 rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(122,150,255,0.24),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(190,214,255,0.32),transparent_48%)] blur-2xl dark:bg-[radial-gradient(circle_at_top_left,rgba(96,124,255,0.26),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.2),transparent_48%)]" />
            )}
            <div
                className={cn(
                    "relative overflow-hidden rounded-2xl border border-[#D0DFFF] bg-white transition-all duration-300 dark:border-border dark:bg-card",
                    highlighted &&
                        "border-[#AFC7FF] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,255,0.95))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)] dark:border-[#4E6FE0]/55 dark:bg-[linear-gradient(180deg,rgba(10,20,48,0.98),rgba(12,26,58,0.94))] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
                    innerClassName
                )}
            >
                {highlighted && (
                    <>
                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(120,149,255,0.68),rgba(212,226,255,0.78),rgba(255,255,255,0.94))] opacity-95" />
                        <div className="pointer-events-none absolute inset-[1px] rounded-[15px] bg-[radial-gradient(circle_at_top_left,rgba(218,228,255,0.72),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(239,244,255,0.92),transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,251,255,0.94))] dark:bg-[radial-gradient(circle_at_top_left,rgba(96,124,255,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.12),transparent_48%),linear-gradient(180deg,rgba(10,20,48,0.98),rgba(12,26,58,0.94))]" />
                    </>
                )}
                <div className={cn("relative z-10", className)}>
                    {children}
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
