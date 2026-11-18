"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    Instagram,
    CheckCircle2,
    XCircle,
    Loader2,
    Unlink,
    AlertTriangle,
    RefreshCw,
    Wrench,
    PauseCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";
import { apiClient, ApiError } from "@/lib/api/client";
import {
    useInstagramAccounts,
    useRefreshInstagramToken,
    useResubscribeWebhook,
    useCheckSubscription
} from "@/hooks/useInstagramAccounts";
import { useSetupStatus } from "@/hooks/useSetup";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="w-full max-w-3xl mx-auto py-24 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        }>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    const { data: accounts, isLoading } = useInstagramAccounts();
    const { data: setup } = useSetupStatus();

    const refreshMutation = useRefreshInstagramToken();
    const resubscribeMutation = useResubscribeWebhook();
    const checkSubscriptionMutation = useCheckSubscription();

    const [connectingIG, setConnectingIG] = useState(false);
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
    const [refreshingId, setRefreshingId] = useState<string | null>(null);
    const [resubscribingId, setResubscribingId] = useState<string | null>(null);
    const [checkingSubId, setCheckingSubId] = useState<string | null>(null);

    const [subStatus, setSubStatus] = useState<
        Record<string, {
            subscribedFields: string[];
            hasComments: boolean;
            hasMessages: boolean;
        } | null>
    >({});

    const [banner, setBanner] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    useEffect(() => {
        const igConnected = searchParams.get("instagram_connected");
        const igError = searchParams.get("instagram_error");

        if (igConnected === "true") {
            setBanner({
                type: "success",
                message: "Cuenta de Instagram conectada correctamente."
            });

            void queryClient.invalidateQueries({
                queryKey: ["instagram-accounts"]
            });

            window.history.replaceState({}, "", "/settings");

        } else if (igError) {
            const errorMessages: Record<string, string> = {
                access_denied: "Se canceló la conexión con Instagram.",
                no_instagram_business_account: "No se encontró una cuenta de Instagram Business o Creator. Primero cambia tu cuenta de Instagram a una cuenta profesional.",
                account_already_connected: "Esta cuenta de Instagram ya está conectada a otro usuario de esta plataforma.",
                state_mismatch: "La conexión ha caducado. Inténtalo nuevamente.",
                setup_required: "Primero guarda las credenciales de tu aplicación de Meta en el asistente de configuración.",
                server_error: "Algo salió mal. Revisa los detalles e inténtalo nuevamente.",
                invalid_callback: "Respuesta de conexión no válida. Inténtalo nuevamente.",
                no_linked_instagram: "Se encontraron páginas de Facebook, pero ninguna tiene vinculada una cuenta profesional de Instagram. Comprueba que Instagram esté conectado a la página y sea una cuenta Business o Creator.",
                facebook_permissions_missing: "Meta no concedió todos los permisos necesarios para consultar tus páginas de Facebook. Revisa los permisos de la aplicación y vuelve a autorizar la conexión.",
                no_accessible_facebook_pages: "Facebook autorizó la conexión, pero no se encontraron páginas accesibles para esta cuenta. Comprueba que la página esté agregada al portafolio Creator Academy Pro y asignada al usuario del sistema PROSPECTOR AI.",
                facebook_page_token_missing: "Se encontró una página o cuenta profesional, pero Meta no devolvió un token de acceso válido para esa página. Revisa los permisos y la asignación de activos.",
                unified_login_permissions_required: "Meta no concedió los permisos necesarios para leer las cuentas de Instagram asignadas. En tu configuración de Facebook Login for Business agrega business_management junto con instagram_basic, instagram_manage_messages e instagram_manage_comments y vuelve a conectar.",
                no_assigned_instagram_accounts: "Meta no devolvió ninguna cuenta de Instagram asignada. En el inicio de sesión de Unified Login selecciona tu cuenta profesional de Instagram como activo del portafolio y vuelve a intentarlo.",
                test_user_required: "Añade esta cuenta de Instagram como usuario de prueba para utilizar la herramienta de automatización. En tu aplicación de Meta, entra en App Roles > Roles > Add People > Instagram Tester. Después, acepta la invitación en Instagram y vuelve a conectar."
            };

            const debugDetail = searchParams.get("debug");

            setBanner({
                type: "error",
                message: (errorMessages[igError] ?? `Error: ${igError}`) +
                    (debugDetail ? ` - ${debugDetail}` : "")
            });

            window.history.replaceState({}, "", "/settings");
        }
    }, [searchParams, queryClient]);

    useEffect(() => {
        if (!banner) return;

        const timer = setTimeout(() => setBanner(null), 8000);

        return () => clearTimeout(timer);
    }, [banner]);

    const handleConnectInstagram = async () => {
        setConnectingIG(true);

        try {
            const { url } = await apiClient<{ url: string }>(
                "/instagram/connect?method=unified_login"
            );
            window.location.href = url;

        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : "No se pudo iniciar la conexión con Instagram.";

            setBanner({ type: "error", message });
            setConnectingIG(false);
        }
    };

    const handleDisconnect = async (accountId: string) => {
        if (!confirm(
            "¿Deseas desconectar esta cuenta de Instagram? Se eliminarán todas las automatizaciones asociadas a ella."
        )) return;

        setDisconnectingId(accountId);

        try {
            await apiClient(`/instagram/disconnect/${accountId}`, {
                method: "DELETE"
            });

            void queryClient.invalidateQueries({
                queryKey: ["instagram-accounts"]
            });

            setBanner({
                type: "success",
                message: "Cuenta de Instagram desconectada correctamente."
            });

        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : "No se pudo desconectar la cuenta.";

            setBanner({ type: "error", message });

        } finally {
            setDisconnectingId(null);
        }
    };

    const handleCheckSubscription = async (accountId: string) => {
        setCheckingSubId(accountId);

        try {
            const result = await checkSubscriptionMutation.mutateAsync(accountId);

            setSubStatus(prev => ({
                ...prev,
                [accountId]: result
            }));

        } catch {
            setSubStatus(prev => ({
                ...prev,
                [accountId]: null
            }));

        } finally {
            setCheckingSubId(null);
        }
    };

    const handleResubscribe = async (accountId: string) => {
        setResubscribingId(accountId);

        try {
            const result = await resubscribeMutation.mutateAsync(accountId);

            setBanner({
                type: "success",
                message: `Suscripción al webhook actualizada (${result.subscribedFields}). Comenta una de tus publicaciones para probarla.`
            });

            void handleCheckSubscription(accountId);

        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : "No se pudo actualizar la suscripción del webhook.";

            setBanner({ type: "error", message });

        } finally {
            setResubscribingId(null);
        }
    };

    const handleRefreshToken = async (accountId: string) => {
        setRefreshingId(accountId);

        try {
            const result = await refreshMutation.mutateAsync(accountId);

            setBanner({
                type: "success",
                message: `Token renovado correctamente. Nueva vigencia: ${result.token_days_remaining} días.`
            });

        } catch (err) {
            const apiErr = err instanceof ApiError ? err : null;

            if (apiErr?.status === 400) {
                setBanner({
                    type: "error",
                    message: "El token ha caducado o ya no es válido. Vuelve a conectar tu cuenta de Instagram."
                });
            } else {
                setBanner({
                    type: "error",
                    message: "No se pudo renovar el token. Inténtalo nuevamente."
                });
            }

        } finally {
            setRefreshingId(null);
        }
    };

    const handleSignOut = async () => {
        const supabase = createBrowserClient();

        await supabase.auth.signOut();

        window.location.href = "/";
    };

    return (
        <div className="w-full max-w-3xl mx-auto space-y-5 pb-16">

            <div>
                <h1 className="text-xl font-heading font-semibold tracking-tight text-foreground">
                    Configuración
                </h1>

                <p className="text-[13px] text-muted-foreground mt-1">
                    Cuentas conectadas y configuración de esta plataforma.
                </p>
            </div>

            {banner && (
                <div className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[13px] font-medium",
                    banner.type === "success"
                        ? "bg-secondary/10 text-secondary"
                        : "bg-destructive/10 text-destructive"
                )}>
                    {banner.type === "success"
                        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                        : <XCircle className="w-4 h-4 shrink-0" />}

                    <span className="min-w-0">
                        {banner.message}
                    </span>
                </div>
            )}

            {/* Aplicación de Meta */}

            <section className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">

                <div className="min-w-0">
                    <h2 className="text-[14px] font-heading font-semibold text-foreground">
                        Aplicación de Meta
                    </h2>

                    <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                        {setup?.configured
                            ? <>
                                Configurada - aplicación{" "}
                                <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                                    {setup.metaAppId}
                                </code>
                            </>
                            : "No configurada: el motor permanecerá inactivo hasta completar la configuración."
                        }
                    </p>
                </div>

                <Link
                    href="/setup"
                    className={cn(
                        "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        setup?.configured
                            ? "border border-border hover:bg-muted text-foreground"
                            : "bg-foreground text-background font-semibold hover:opacity-90"
                    )}
                >
                    <Wrench className="w-3.5 h-3.5" />

                    {setup?.configured
                        ? "Asistente de configuración"
                        : "Completar configuración"
                    }
                </Link>

            </section>

            {/* Cuentas de Instagram */}

            <section className="bg-card border border-border rounded-xl p-5 space-y-4">

                <div className="flex items-center justify-between gap-4">

                    <div>
                        <h2 className="text-[14px] font-heading font-semibold text-foreground">
                            Cuentas de Instagram
                        </h2>

                        <p className="text-[13px] text-muted-foreground mt-0.5">
                            Solo se admiten cuentas profesionales o de creador.
                        </p>
                    </div>

                    <button
                        onClick={handleConnectInstagram}
                        disabled={connectingIG}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-foreground text-background text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                        {connectingIG
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Instagram className="w-3.5 h-3.5" />
                        }

                        {connectingIG ? "Conectando..." : "Conectar"}
                    </button>

                </div>

                <div className="space-y-2">

                    {isLoading ? (

                        <div className="space-y-2">
                            {[1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="h-16 rounded-lg bg-muted/50 animate-pulse"
                                />
                            ))}
                        </div>

                    ) : accounts && accounts.length > 0 ? (

                        accounts.map((account) => (

                            <div key={account.id} className="space-y-2">

                                {/* Pausa de seguridad */}

                                {account.is_paused && (
                                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium bg-destructive/10 text-destructive">

                                        <PauseCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />

                                        <span>
                                            <b>Pausa de seguridad</b>: Instagram detectó problemas en los envíos, por lo que los mensajes directos están pausados hasta{" "}
                                            {account.paused_until
                                                ? new Date(account.paused_until).toLocaleString("es-PE")
                                                : "más adelante"
                                            } para proteger esta cuenta.
                                        </span>

                                    </div>
                                )}

                                {/* Estado del token */}

                                {account.token_status !== "ok" && (
                                    <div className={cn(
                                        "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-[12px] font-medium",
                                        account.token_status === "expired"
                                            ? "bg-destructive/10 text-destructive"
                                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    )}>

                                        <div className="flex items-center gap-2 min-w-0">

                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />

                                            <span className="truncate">
                                                {account.token_status === "expired"
                                                    ? "Token caducado: las automatizaciones están pausadas. Vuelve a conectar tu cuenta para reanudarlas."
                                                    : `El token caduca en ${account.token_days_remaining} día${account.token_days_remaining === 1 ? "" : "s"}. Puedes renovarlo ahora.`
                                                }
                                            </span>

                                        </div>

                                        {account.token_status === "expiring" ? (

                                            <button
                                                onClick={() => handleRefreshToken(account.id)}
                                                disabled={refreshingId === account.id}
                                                className="inline-flex items-center gap-1 font-semibold shrink-0 hover:opacity-80"
                                            >
                                                {refreshingId === account.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <RefreshCw className="w-3 h-3" />
                                                }

                                                Renovar
                                            </button>

                                        ) : (

                                            <button
                                                onClick={handleConnectInstagram}
                                                disabled={connectingIG}
                                                className="inline-flex items-center gap-1 font-semibold shrink-0 hover:opacity-80"
                                            >
                                                Reconectar
                                            </button>

                                        )}

                                    </div>
                                )}

                                {/* Información de la cuenta */}

                                <div className="flex items-center justify-between p-3 rounded-lg border border-border">

                                    <div className="flex items-center gap-3 min-w-0">

                                        <div className="relative w-9 h-9 rounded-full ig-ring p-[1.5px] shrink-0">

                                            <div className="w-full h-full rounded-full bg-background overflow-hidden flex items-center justify-center">

                                                {account.profile_picture_url ? (
                                                    <img
                                                        src={account.profile_picture_url}
                                                        alt={account.username}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <Instagram className="w-4 h-4 text-muted-foreground" />
                                                )}

                                            </div>

                                        </div>

                                        <div className="min-w-0">

                                            <div className="flex items-center gap-1.5">

                                                <span className="text-[13px] font-semibold text-foreground truncate">
                                                    @{account.username}
                                                </span>

                                                {account.token_status === "ok" && !account.is_paused
                                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0" />
                                                    : <AlertTriangle className={cn(
                                                        "w-3.5 h-3.5 shrink-0",
                                                        account.token_status === "expired"
                                                            ? "text-destructive"
                                                            : "text-amber-500"
                                                    )} />
                                                }

                                            </div>

                                            <span className="text-[11px] text-muted-foreground">
                                                Conectada{" "}
                                                {new Date(account.created_at).toLocaleDateString("es-PE", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric"
                                                })}
                                            </span>

                                        </div>

                                    </div>

                                    <div className="flex items-center gap-0.5 shrink-0">

                                        <button
                                            onClick={() => handleCheckSubscription(account.id)}
                                            disabled={checkingSubId === account.id}
                                            title="Comprobar qué eventos del webhook tiene activos Meta para esta cuenta"
                                            className="inline-flex items-center gap-1 h-7 px-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                        >
                                            {checkingSubId === account.id
                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                : null
                                            }

                                            {checkingSubId === account.id
                                                ? "Consultando..."
                                                : "Comprobar estado"
                                            }
                                        </button>

                                        <button
                                            onClick={() => handleResubscribe(account.id)}
                                            disabled={resubscribingId === account.id}
                                            title="Volver a sincronizar la suscripción del webhook"
                                            className="inline-flex items-center gap-1 h-7 px-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                        >
                                            {resubscribingId === account.id
                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                : <RefreshCw className="w-3 h-3" />
                                            }

                                            {resubscribingId === account.id
                                                ? "Sincronizando..."
                                                : "Reparar webhooks"
                                            }
                                        </button>

                                        <button
                                            onClick={() => handleDisconnect(account.id)}
                                            disabled={disconnectingId === account.id}
                                            className="inline-flex items-center gap-1 h-7 px-2 text-[12px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                        >
                                            {disconnectingId === account.id
                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                : <Unlink className="w-3 h-3" />
                                            }

                                            Desconectar
                                        </button>

                                    </div>

                                </div>

                                {/* Estado de los webhooks */}

                                {subStatus[account.id] !== undefined && (
                                    <div className={cn(
                                        "px-3 py-2.5 rounded-lg text-[12px] font-mono",
                                        subStatus[account.id] === null
                                            ? "bg-destructive/10 text-destructive"
                                            : subStatus[account.id]?.hasComments
                                                ? "bg-secondary/10 text-secondary"
                                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    )}>

                                        {subStatus[account.id] === null ? (

                                            <span>
                                                No se pudo consultar el estado de la suscripción en Meta.
                                            </span>

                                        ) : (

                                            <div className="space-y-1">

                                                <div className="flex items-center gap-3">

                                                    <span className="font-bold">
                                                        {subStatus[account.id]?.hasComments
                                                            ? "✓ Comentarios"
                                                            : "✗ Comentarios"
                                                        }
                                                    </span>

                                                    <span className="font-bold">
                                                        {subStatus[account.id]?.hasMessages
                                                            ? "✓ Mensajes"
                                                            : "✗ Mensajes"
                                                        }
                                                    </span>

                                                </div>

                                                <div className="text-muted-foreground text-[10px]">
                                                    {subStatus[account.id]?.subscribedFields.join(", ") || "Ninguno"}
                                                </div>

                                                {!subStatus[account.id]?.hasComments && (
                                                    <div className="text-[10px]">
                                                        Los comentarios no están suscritos. Usa «Reparar webhooks» y comprueba que la URL de devolución de llamada esté verificada en el portal de Meta.
                                                    </div>
                                                )}

                                            </div>

                                        )}

                                    </div>
                                )}

                            </div>

                        ))

                    ) : (

                        <div className="text-center py-8 text-[13px] text-muted-foreground">

                            <Instagram className="w-6 h-6 mx-auto mb-2 opacity-30" />

                            <p>
                                Todavía no hay cuentas conectadas.
                            </p>

                        </div>

                    )}

                </div>

            </section>

            {/* Sesión */}

            <section className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">

                <h2 className="text-[14px] font-heading font-semibold text-foreground">
                    Sesión
                </h2>

                <button
                    onClick={handleSignOut}
                    className="h-8 px-3 rounded-lg text-[13px] font-medium text-muted-foreground border border-border hover:text-destructive hover:border-destructive/40 transition-colors"
                >
                    Cerrar sesión
                </button>

            </section>

        </div>
    );
}
