"use client";

/**
 * Asistente de configuración - from fresh deployment to verified Meta webhook, five steps:
 *  1. Create a Meta app
 *  2. Save Instagram app credentials (stored encrypted)
 *  3. Wire the Meta portal (webhook + login redirect)
 *  4. Activa el motor en segundo plano (one SQL snippet)
 *  5. Understy who can trigger it (testers, going public)
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Wrench, KeyRound, Webhook, Clock3, CheckCircle2, Copy, Check,
    ExternalLink, Loader2, ShieldCheck, AlertTriangle, Users
} from "lucide-react";
import { useSetupStatus, useSaveSetup } from "@/hooks/useSetup";
import { cn } from "@/lib/utils";

function CopyField({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div>
            <label className="micro-label block mb-1">{label}</label>
            <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[12px] font-mono bg-muted/60 border border-border rounded-lg px-3 py-2 break-all select-all">
                    {value}
                </code>
                <button
                    onClick={copy}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Copy"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-secondary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>
        </div>
    );
}

function NumberedList({ items }: { items: React.ReactNode[] }) {
    return (
        <ol className="space-y-2 list-none">
            {items.map((content, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] text-foreground/90 leading-relaxed">
                    <span className="w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span>{content}</span>
                </li>
            ))}
        </ol>
    );
}

function StepCard({
    step, title, icon: Icon, done, children,
}: {
    step: number;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    done?: boolean;
    children: React.ReactNode;
}) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: step * 0.05 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
        >
            <div className="flex items-center gap-3 px-5 h-12 border-b border-border">
                <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    done ? "bg-secondary/10" : "bg-muted"
                )}>
                    {done ? <CheckCircle2 className="w-4 h-4 text-secondary" /> : <Icon className="w-4 h-4 text-muted-foreground" />}
                </div>
                <span className="micro-label">Step {step}</span>
                <h2 className="text-[13.5px] font-heading font-semibold text-foreground">{title}</h2>
            </div>
            <div className="p-5">{children}</div>
        </motion.section>
    );
}

const inputCls = "w-full h-9 text-[13px] font-mono bg-background border border-border rounded-lg px-3 outline-none focus:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/30 transition-colors";

export default function SetupPage() {
    const { data: setup, isLoading } = useSetupStatus();
    const saveMutation = useSaveSetup();

    const [appId, setAppId] = useState("");
    const [appSecret, setAppSecret] = useState("");

    const [fbAppSecret, setFbAppSecret] = useState("");
    const [loginConfigId, setLoginConfigId] = useState("");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);

useEffect(() => {
    setAppId(setup?.metaAppId ?? "");
    setLoginConfigId(setup?.metaLoginConfigId ?? "");
}, [setup?.metaAppId, setup?.metaLoginConfigId]);

    const hyleSave = () => {
        setSaveError(null);
        saveMutation.mutate(
            {
                metaAppId: appId.trim(),

                metaAppSecret: appSecret.trim(),
                metaLoginConfigId: loginConfigId.trim() || null,
                ...(fbAppSecret.trim() ? { metaFbAppSecret: fbAppSecret.trim() } : {}),
            },
            {
                onSuccess: () => { setJustSaved(true); setAppSecret(""); setFbAppSecret(""); },
                onError: (err) => setSaveError(err.message),
            }
        );
    };

    if (isLoading) {
        return (
            <div className="w-full max-w-2xl mx-auto py-24 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const configured = !!setup?.configured;

    return (
        <div className="w-full max-w-2xl mx-auto space-y-4 pb-16">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-heading font-semibold tracking-tight text-foreground flex items-center gap-2">
                        <Wrench className="w-4.5 h-4.5 w-[18px] h-[18px] text-muted-foreground" />
                        Asistente de configuración
                    </h1>
                    <p className="text-[13px] text-muted-foreground mt-1 max-w-md">
                        Conecta tu propia aplicación gratuita de desarrollador de Meta. Toda la información que ingreses se almacena
                        cifrada en tu base de datos de Supabase.
                    </p>
                </div>
                {configured && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-secondary bg-secondary/10 px-2.5 py-1 rounded-full shrink-0 mt-1">
                        <ShieldCheck className="w-3 h-3" /> Configurado
                    </span>
                )}
            </div>

            {/* Step 1 */}
            <StepCard step={1} title="Crea tu aplicación de Meta" icon={ExternalLink} done={configured}>
                <NumberedList items={[
                    <>Ve a <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">developers.facebook.com/apps</a> y haz clic en <b>Create App (Crear aplicación)</b>.</>,
                    <>Caso de uso <b>Manage messaging & content on Instagram</b> (Administrar mensajes y contenido en Instagram). La aplicación debe pertenecer a un portafolio comercial de Meta.</>,
                    <>En el panel de tu aplicación, abre <b>Use cases → Manage messaging & content on Instagram → Customize → API setup with Unified Login</b>.</>,
                    <>En <b>Configure your app</b>, crea una configuración, solicita <b>instagram_basic</b>, <b>instagram_manage_messages</b> e <b>instagram_manage_comments</b>, selecciona <b>Use this configuration</b> y registra la URL de devolución de llamada que aparece en el paso 3.</>,
                    <>Tu Instagram debe ser una cuenta <b>Business or Creator</b> (puedes cambiarla desde Instagram en: Settings → Account type).</>,
                ]} />
                <div className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                    <span>
                        Tu aplicación comienza en <b>Development mode</b> - ideal para crear y realizar pruebas. En este modo, las automatizaciones
                        funcionan con las cuentas que tienen un <b>role on your app</b> (tu cuenta y los evaluadores; consulta el paso 5). Para permitir que el
                        público en general las active, solicita la revisión gratuita de Meta <b>App Review</b> una vez finalizadas las pruebas.
                    </span>
                </div>
            </StepCard>

            {/* Step 2 */}
            <StepCard step={2} title="Guarda las credenciales de tu aplicación" icon={KeyRound} done={configured && !justSaved}>
                {configured && (
                    <div className="mb-4 flex items-center gap-2 text-[12px] font-medium text-secondary bg-secondary/10 rounded-lg px-3 py-2.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Guardado para la aplicación <code className="font-mono font-semibold">{setup?.metaAppId}</code>. Vuelve a ingresarlas abajo únicamente si deseas cambiarlas.</span>
                    </div>
                )}
                <div className="space-y-3">
                    <div>
                        <label className="micro-label block mb-1">Meta App ID (App Settings → Basic)</label>
                        <input
                            value={appId}
                            onChange={(e) => setAppId(e.target.value)}
                            placeholder={setup?.metaAppId ?? "e.g. 1234567890123456"}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="micro-label block mb-1">Secreto anterior de Instagram (solo para el método clásico)</label>
                        <input
                            type="password"
                            value={appSecret}
                            onChange={(e) => setAppSecret(e.target.value)}
                            placeholder="Secreto hexadecimal de 32 caracteres"
                            className={inputCls}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Se cifra antes de guardarse en la base de datos. Nunca se registra ni vuelve a mostrarse.
                        </p>
                    </div>
                    <div>
                        <label className="micro-label block mb-1">Meta App Secret (App Settings → Basic)</label>
                        <input
                            type="password"
                            value={fbAppSecret}
                            onChange={(e) => setFbAppSecret(e.target.value)}
                            placeholder="Solo si falla la verificación de la firma del webhook"
                            className={inputCls}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Es el secreto de App settings → Basic. Se cifra y se utiliza solo en el servidor para cambiar el código OAuth por el token de Unified Login y verificar webhooks. Nunca se muestra nuevamente.
                        </p>
                    </div>
                    <div>
                        <label className="micro-label block mb-1">Meta Login Configuration ID (config_id)</label>
                        <input
                            value={loginConfigId}
                            onChange={(e) => setLoginConfigId(e.target.value)}
                            placeholder="ID de la configuración de Unified Login"
                            className={inputCls}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Copia el ID de la configuración que seleccionaste en API setup with Unified Login. No es un secreto.
                        </p>
                    </div>
                    {saveError && <p className="text-[12px] text-destructive font-medium">{saveError}</p>}
                    {justSaved && <p className="text-[12px] text-secondary font-medium">Guardado. Continúa con el paso 3.</p>}
                    <button
                        onClick={hyleSave}
                                          disabled={
    saveMutation.isPending ||
    !appId.trim() ||
    (!appSecret.trim() && !configured)
}
      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-foreground text-background text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                        {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                        {saveMutation.isPending ? "Guardyo…" : "Guardar credenciales"}
                    </button>
                </div>
            </StepCard>

            {/* Step 3 */}
            <StepCard step={3} title="Configura el portal de Meta" icon={Webhook}>
                {!configured && !justSaved ? (
                    <p className="text-[13px] text-muted-foreground">Primero completa el paso 2. El token de verificación del webhook se genera cuyo guardas las credenciales.</p>
                ) : (
                    <div className="space-y-5">
                        <div>
                            <p className="text-[13px] font-medium text-foreground mb-2.5">
                                A. Webhooks - <span className="text-muted-foreground font-normal">Manage messaging & content on Instagram → API setup with Unified Login → Configure webhooks</span>
                            </p>
                            <div className="space-y-2.5">
                                <CopyField label="URL de devolución de llamada" value={setup?.webhookUrl ?? ""} />
                                <CopyField label="Token de verificación" value={setup?.webhookVerifyToken ?? ""} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-2">
                                Haz clic en <b>Verify y save (Verificar y guardar)</b> y suscríbete a los eventos <b>comments (comentarios)</b> y <b>messages (mensajes)</b>.
                            </p>
                        </div>
                        <div className="h-px bg-border" />
                        <div>
                            <p className="text-[13px] font-medium text-foreground mb-2.5">
                                B. Unified Login - <span className="text-muted-foreground font-normal">API setup with Unified Login → configuración seleccionada</span>
                            </p>
                            <CopyField label="OAuth redirect URI" value={setup?.oauthRedirectUri ?? ""} />
                            <p className="text-[11px] text-muted-foreground mt-2">
                                Debe coincidir exactamente, carácter por carácter.
                            </p>
                        </div>
                    </div>
                )}
            </StepCard>

            {/* Step 4 */}
            <StepCard step={4} title="Activa el motor en segundo plano" icon={Clock3}>
                <p className="text-[13px] text-muted-foreground mb-3 leading-relaxed">
                    La mayoría de los mensajes directos se envían inmediatamente mediante el webhook. Este proceso cron se encarga del resto: mensajes pendientes por límites de envío,
                    reintentos y renovación automática de tokens. En <b>Supabase → SQL Editor</b>, reemplaza{" "}
                    <code className="font-mono text-[11px] bg-muted px-1 rounded">YOUR_CRON_SECRET</code> with your
                    deployment&apos;s CRON_SECRET y run:
                </p>
                <div className="relative">
                    <pre className="text-[11px] font-mono bg-zinc-950 text-zinc-300 rounded-lg p-3.5 overflow-x-auto whitespace-pre border border-border">
                        {setup?.cronSnippet ?? ""}
                    </pre>
                    <button
                        onClick={() => void navigator.clipboard.writeText(setup?.cronSnippet ?? "")}
                        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                        title="Copiar SQL"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                    Verifica con <code className="font-mono bg-muted px-1 rounded">select * from cron.job;</code> - deberías encontrar <code className="font-mono bg-muted px-1 rounded">open-autodm-process-jobs</code>.
                </p>
            </StepCard>

            {/* Step 5 */}
            <StepCard step={5} title="Quién puede activar las automatizaciones" icon={Users}>
                <div className="space-y-4 text-[13px] text-foreground/90 leading-relaxed">
                    <p>
                        In <b>Development mode</b>, Instagram solo envía eventos de las cuentas que tienen un rol en tu aplicación:
                        en <b>ambos lados</b>: la cuenta que conectas <i>y</i> the audience accounts whose comments, DMs,
                        o respuestas a historias activan automatizaciones. Los comentarios de personas externas no generan ningún webhook.
                    </p>
                    <div>
                        <p className="font-medium text-foreground mb-2">Añadir una cuenta de prueba:</p>
                        <NumberedList items={[
                            <>Meta portal → your app → <b>App roles → Roles → Add people (Añadir personas)</b>.</>,
                            <>Selecciona el rol <b>Instagram Tester (Evaluador de Instagram)</b> → el nombre de usuario de Instagram de esa persona → y envía la invitación.</>,
                            <>La persona debe aceptar la invitación <b>desde la aplicación de Instagram</b>: Settings → Website permissions / Apps y websites → <b>Tester invites → Accept</b>. Hasta que la acepte, sus eventos no serán visibles para tu webhook.</>,
                        ]} />
                    </div>
                    <div className="flex items-start gap-2 text-[12px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                        <span>
                            <b>Para habilitar el acceso público:</b> para que las automatizaciones se activen con comentarios de cualquier persona, solicita <b>Advanced Access</b> mediante la revisión gratuita de Meta
                            App Review - sube una grabación breve de tu automatización funcionando. La aprobación suele tardar unos días; después no será necesario modificar nada en
                            esta aplicación.
                        </span>
                    </div>
                </div>
            </StepCard>

            {configured && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-secondary/25 bg-secondary/5 p-4 flex items-start gap-3"
                >
                    <CheckCircle2 className="w-4.5 h-4.5 w-[18px] h-[18px] text-secondary shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[13px] font-semibold text-foreground">Configuración completada: conecta Instagram</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">
                            Ve a <a href="/settings" className="text-primary font-medium underline underline-offset-2">Settings</a> y
                            haz clic en <b>Connect (Conectar)</b> utilizando la cuenta de Instagram vinculada a tu aplicación de Meta.
                        </p>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
