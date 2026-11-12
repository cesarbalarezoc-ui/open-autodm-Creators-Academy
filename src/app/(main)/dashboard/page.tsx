"use client";
import Link from "next/link";
import { useMemo } from "react";
import {
    Bot,
    Send,
    Instagram,
    MessageCircle,
    Wrench,
    CheckCircle2,
    Circle,
    ArrowRight,
    Plus
} from "lucide-react";

import { useAutomations } from "@/hooks/useAutomations";
import { useContacts } from "@/hooks/useContacts";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useSetupStatus } from "@/hooks/useSetup";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
    const { account: connectedAccount, accountId } = useActiveAccount();
    const { data: automations } = useAutomations(accountId);
    const { data: setup } = useSetupStatus();
    const { data: contacts } = useContacts(accountId);

    const analyticsRange = useMemo(() => {
        const now = Date.now();
        return {
            from: new Date(now - 30 * 86400_000).toISOString(),
            to: new Date(now).toISOString(),
        };
    }, []);

    const { data: analytics } = useAnalytics({
        ...analyticsRange,
        automationId: "all",
        accountId
    });

    const activeCount = automations?.filter(a => a.is_active).length ?? 0;
    const totalDms = automations?.reduce(
        (sum, a) => sum + a.total_dms_sent,
        0
    ) ?? 0;

    const checklist = [
        {
            label: "Configura las credenciales de tu aplicación Meta",
            done: !!setup?.configured,
            href: "/setup"
        },
        {
            label: "Conecta tu cuenta de Instagram",
            done: !!connectedAccount,
            href: "/settings"
        },
        {
            label: "Crea tu primera automatización",
            done: (automations?.length ?? 0) > 0,
            href: "/automations"
        },
        {
            label: "Activa tu automatización",
            done: activeCount > 0,
            href: "/automations"
        },
    ];

    const allDone = checklist.every(c => c.done);

    const stats = [
        {
            label: "Automatizaciones activas",
            value: String(activeCount),
            icon: Bot
        },
        {
            label: "Comentarios · 30 días",
            value: (analytics?.totals.comments ?? 0).toLocaleString(),
            icon: MessageCircle
        },
        {
            label: "Mensajes enviados",
            value: totalDms.toLocaleString(),
            icon: Send
        },
        {
            label: "Contactos capturados",
            value: String(contacts?.length ?? 0),
            icon: Instagram
        },
    ];

    return (
        <div className="w-full max-w-5xl mx-auto space-y-8 pb-16">

            {/* Encabezado */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl font-heading font-semibold tracking-tight text-foreground">
                        {connectedAccount ? (
                            <>
                                ¡Bienvenido de nuevo,{" "}
                                <span className="brand-gradient-text">
                                    @{connectedAccount.username}
                                </span>
                            </>
                        ) : (
                            "¡Bienvenido a PROSPECTOR AI!"
                        )}
                    </h1>

                    <p className="text-[13px] text-muted-foreground mt-1">
                        Tu centro de automatización inteligente de Instagram.
                    </p>
                </div>

                <Link
                    href="/automations"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva automatización
                </Link>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="bg-card border border-border rounded-xl p-4 brand-glow"
                    >
                        <div className="flex items-center justify-between">
                            <span className="micro-label">{stat.label}</span>
                            <stat.icon className="w-3.5 h-3.5 text-cyan-400" />
                        </div>

                        <p className="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2 tabular-nums">
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

                {/* Primeros pasos */}
                <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
                    <h2 className="text-[14px] font-heading font-semibold text-foreground">
                        Primeros pasos
                    </h2>

                    <p className="text-[13px] text-muted-foreground mt-0.5 mb-4">
                        {allDone
                            ? "¡Todo está configurado! Tus automatizaciones están activas."
                            : "Completa estos cuatro pasos para comenzar a automatizar Instagram."}
                    </p>

                    <div className="space-y-1.5">
                        {checklist.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-lg"
                            >
                                <div
                                    className={cn(
                                        "flex items-center justify-between h-10 px-3 rounded-lg border transition-colors",
                                        item.done
                                            ? "border-transparent bg-muted/40"
                                            : "border-border hover:border-cyan-400/60"
                                    )}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {item.done ? (
                                            <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                                        ) : (
                                            <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                                        )}

                                        <span
                                            className={cn(
                                                "text-[13px] truncate",
                                                item.done
                                                    ? "text-muted-foreground line-through"
                                                    : "text-foreground font-medium"
                                            )}
                                        >
                                            {item.label}
                                        </span>
                                    </div>

                                    {!item.done && (
                                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Estado del sistema */}
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
                    <h2 className="text-[14px] font-heading font-semibold text-foreground mb-4">
                        Estado del sistema
                    </h2>

                    <div className="space-y-1.5">
                        {[
                            {
                                label: "Aplicación Meta",
                                ok: !!setup?.configured,
                                detail: setup?.configured ? "Configurada" : "Pendiente"
                            },
                            {
                                label: "Instagram",
                                ok: !!connectedAccount,
                                detail: connectedAccount
                                    ? `@${connectedAccount.username}`
                                    : "Sin conectar"
                            },
                            {
                                label: "Motor de automatización",
                                ok: activeCount > 0,
                                detail: activeCount > 0
                                    ? `${activeCount} activas`
                                    : "Inactivo"
                            },
                        ].map((row) => (
                            <div
                                key={row.label}
                                className="flex items-center justify-between h-10 px-3 rounded-lg bg-muted/40"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            row.ok
                                                ? "bg-cyan-400"
                                                : "bg-muted-foreground/40"
                                        )}
                                    />

                                    <span className="text-[13px] font-medium text-foreground">
                                        {row.label}
                                    </span>
                                </div>

                                <span className="text-[12px] text-muted-foreground truncate max-w-[120px]">
                                    {row.detail}
                                </span>
                            </div>
                        ))}
                    </div>

                    {!setup?.configured && (
                        <Link
                            href="/setup"
                            className="mt-4 flex items-center justify-center gap-1.5 h-9 w-full rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-opacity"
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            Configurar aplicación Meta
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}