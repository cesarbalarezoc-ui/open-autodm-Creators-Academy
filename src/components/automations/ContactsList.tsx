"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    Search,
    Users,
    MessageCircle,
    Send,
    Image as ImageIcon,
    MousePointerClick,
    RefreshCw,
    UserCheck,
    UserX,
    Clock,
    Filter,
    AlertCircle
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useContacts, type ContactFromDB } from "@/hooks/useContacts";

type TriggerFilter = "all" | "comment" | "dm" | "story_reply" | "button";
type FollowFilter = "all" | "following" | "not_following" | "unknown";

const TRIGGER_CONFIG: Record<
    string,
    {
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        className: string;
    }
> = {
    comment: {
        label: "Comentario",
        icon: MessageCircle,
        className: "bg-orange-500/10 text-orange-500 border-orange-500/20"
    },
    dm: {
        label: "Mensaje directo",
        icon: Send,
        className: "bg-blue-500/10 text-blue-500 border-blue-500/20"
    },
    story_reply: {
        label: "Respuesta a historia",
        icon: ImageIcon,
        className: "bg-green-500/10 text-green-500 border-green-500/20"
    },
    button: {
        label: "Clic en botón",
        icon: MousePointerClick,
        className: "bg-purple-500/10 text-purple-500 border-purple-500/20"
    }
};

const AVATAR_GRADIENTS = [
    "from-pink-500 to-orange-400",
    "from-violet-500 to-indigo-400",
    "from-emerald-500 to-teal-400",
    "from-amber-500 to-red-400",
    "from-sky-500 to-blue-500"
];

function avatarGradient(seed: string): string {
    let hash = 0;

    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }

    return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]!;
}

function formatDate(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return "Sin fecha";
    }

    return date.toLocaleDateString("es-PE", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function relationshipBadge(contact: ContactFromDB) {
    if (contact.follows_business === true) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-green-500/10 text-green-500 border-green-500/20">
                <UserCheck className="w-3 h-3" />
                Seguidor verificado
            </span>
        );
    }

    if (contact.follows_business === false) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-500 border-amber-500/20">
                <UserX className="w-3 h-3" />
                No sigue la cuenta
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-muted/40 text-muted-foreground border-border/50">
            <Clock className="w-3 h-3" />
            Pendiente de verificar
        </span>
    );
}

export function ContactsList() {
    const {
        data: contacts,
        isLoading,
        isError,
        error,
        refetch,
        isFetching
    } = useContacts();

    const [search, setSearch] = useState("");
    const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>("all");
    const [followFilter, setFollowFilter] = useState<FollowFilter>("all");

    // ESTADÍSTICAS DE LOS CONTACTOS CARGADOS

    const stats = useMemo(() => {
        const list = contacts ?? [];

        return {
            total: list.length,
            following: list.filter(c => c.follows_business === true).length,
            notFollowing: list.filter(c => c.follows_business === false).length,
            unknown: list.filter(c => c.follows_business === null).length
        };
    }, [contacts]);

    // FILTROS Y BÚSQUEDA

    const filtered = useMemo(() => {
        if (!contacts) return [];

        const q = search.trim().toLowerCase();

        return contacts.filter(contact => {

            const username = (contact.username ?? "").toLowerCase();

            const userId = contact.audience_ig_user_id.toLowerCase();

            const automation = (contact.automations?.name ?? "").toLowerCase();

            const matchesSearch =
                !q ||
                username.includes(q) ||
                userId.includes(q) ||
                automation.includes(q);

            const matchesTrigger =
                triggerFilter === "all" ||
                contact.last_trigger_type === triggerFilter;

            const matchesFollow =
                followFilter === "all" ||
                (followFilter === "following" && contact.follows_business === true) ||
                (followFilter === "not_following" && contact.follows_business === false) ||
                (followFilter === "unknown" && contact.follows_business === null);

            return matchesSearch && matchesTrigger && matchesFollow;
        });

    }, [contacts, search, triggerFilter, followFilter]);

    // CARGANDO

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div
                            key={i}
                            className="h-24 rounded-xl bg-muted/30 border border-border/40 animate-pulse"
                        />
                    ))}
                </div>

                <div className="h-64 rounded-xl bg-muted/30 border border-border/40 animate-pulse" />
            </div>
        );
    }

    // ERROR DE CONEXIÓN

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-destructive/20 border-dashed rounded-xl bg-destructive/5">

                <AlertCircle className="w-10 h-10 text-destructive mb-4" />

                <h3 className="text-lg font-bold text-foreground mb-2">
                    No se pudieron cargar tus prospectos
                </h3>

                <p className="text-sm text-muted-foreground max-w-md mb-5">
                    Comprueba tu conexión e intenta nuevamente.
                    {error instanceof Error ? ` ${error.message}` : ""}
                </p>

                <button
                    type="button"
                    onClick={() => void refetch()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reintentar
                </button>

            </div>
        );
    }

    // SIN CONTACTOS

    if (!contacts || contacts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-border border-dashed rounded-xl">

                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <Users className="w-8 h-8 text-primary" />
                </div>

                <h3 className="text-xl font-heading font-bold mb-2 text-foreground">
                    Todavía no tienes prospectos
                </h3>

                <p className="text-muted-foreground max-w-md">
                    Cada persona que interactúe con tus automatizaciones
                    aparecerá aquí automáticamente.
                    Podrás consultar su actividad y su estado de seguimiento.
                </p>

            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-5 w-full animate-in fade-in duration-500">

            {/* ENCABEZADO */}

            <div>
                <h2 className="text-xl font-heading font-bold text-foreground">
                    Mis prospectos
                </h2>

                <p className="text-sm text-muted-foreground mt-1">
                    Administra las personas que interactúan con tus automatizaciones.
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                    Mostrando {contacts.length} prospectos cargados.
                </p>
            </div>

            {/* ESTADÍSTICAS */}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

                <StatCard
                    title="Total prospectos"
                    value={stats.total}
                    icon={Users}
                    description="Contactos únicos cargados"
                />

                <StatCard
                    title="Seguidores verificados"
                    value={stats.following}
                    icon={UserCheck}
                    description="Confirmados por Instagram"
                />

                <StatCard
                    title="No seguidores"
                    value={stats.notFollowing}
                    icon={UserX}
                    description="No siguen tu cuenta"
                />

                <StatCard
                    title="Pendientes"
                    value={stats.unknown}
                    icon={Clock}
                    description="Sin verificación disponible"
                />

            </div>

            {/* BARRA DE HERRAMIENTAS */}

            <div className="flex flex-col gap-3 bg-card p-4 rounded-xl border border-border">

                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">

                    <div className="relative w-full sm:max-w-sm">

                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                        <input
                            type="text"
                            placeholder="Buscar usuario o automatización..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-background border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />

                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between">

                        <span className="text-xs font-semibold text-muted-foreground">
                            {filtered.length} resultados
                        </span>

                        <button
                            type="button"
                            onClick={() => void refetch()}
                            disabled={isFetching}
                            className="flex items-center gap-2 px-4 py-2 border border-border/50 rounded-xl bg-background hover:bg-muted/50 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            <RefreshCw
                                className={cn(
                                    "w-4 h-4",
                                    isFetching && "animate-spin"
                                )}
                            />

                            Actualizar
                        </button>

                    </div>

                </div>

                {/* FILTROS */}

                <div className="flex flex-col sm:flex-row gap-3">

                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />

                        <span className="text-xs font-semibold text-muted-foreground">
                            Origen:
                        </span>

                        <select
                            value={triggerFilter}
                            onChange={e => setTriggerFilter(e.target.value as TriggerFilter)}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none"
                        >
                            <option value="all">Todos</option>
                            <option value="comment">Comentarios</option>
                            <option value="dm">Mensajes directos</option>
                            <option value="story_reply">Historias</option>
                            <option value="button">Botones</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">

                        <span className="text-xs font-semibold text-muted-foreground">
                            Seguimiento:
                        </span>

                        <select
                            value={followFilter}
                            onChange={e => setFollowFilter(e.target.value as FollowFilter)}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none"
                        >
                            <option value="all">Todos</option>
                            <option value="following">Seguidores verificados</option>
                            <option value="not_following">No seguidores</option>
                            <option value="unknown">Pendientes</option>
                        </select>

                    </div>

                </div>

            </div>

            {/* TABLA */}

            <div className="w-full overflow-x-auto bg-card border border-border rounded-xl">

                <table className="w-full text-left text-sm whitespace-nowrap">

                    <thead className="bg-muted/30 text-muted-foreground uppercase tracking-widest text-[10px] font-bold border-b border-border/50">

                        <tr>
                            <th className="px-5 py-4">Prospecto</th>
                            <th className="px-5 py-4">Seguimiento</th>
                            <th className="px-5 py-4">Origen</th>
                            <th className="px-5 py-4">Automatización</th>
                            <th className="px-5 py-4">Interacciones</th>
                            <th className="px-5 py-4">Última actividad</th>
                        </tr>

                    </thead>

                    <tbody className="divide-y divide-border/30">

                        {filtered.map((contact, i) => {

                            const trigger = contact.last_trigger_type
                                ? TRIGGER_CONFIG[contact.last_trigger_type]
                                : null;

                            const TriggerIcon = trigger?.icon ?? MessageCircle;

                            const display = contact.username
                                ? `@${contact.username}`
                                : `Usuario IG ${contact.audience_ig_user_id.slice(-6)}`;

                            const initial = (
                                contact.username ??
                                contact.audience_ig_user_id
                            ).charAt(0).toUpperCase();

                            return (

                                <motion.tr
                                    key={contact.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                        delay: Math.min(i * 0.025, 0.3)
                                    }}
                                    className="group hover:bg-muted/30 transition-colors"
                                >

                                    {/* USUARIO */}

                                    <td className="px-5 py-3">

                                        <div className="flex items-center gap-3">

                                            <div
                                                className={cn(
                                                    "w-9 h-9 rounded-full bg-gradient-to-tr flex items-center justify-center shrink-0",
                                                    avatarGradient(contact.audience_ig_user_id)
                                                )}
                                            >
                                                <span className="text-white font-bold text-xs">
                                                    {initial}
                                                </span>
                                            </div>

                                            <div className="flex flex-col">

                                                <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                                                    {display}
                                                </span>

                                                <span className="text-muted-foreground text-[10px] font-mono">
                                                    ID: ...{contact.audience_ig_user_id.slice(-8)}
                                                </span>

                                            </div>

                                        </div>

                                    </td>

                                    {/* SEGUIMIENTO */}

                                    <td className="px-5 py-3">
                                        {relationshipBadge(contact)}
                                    </td>

                                    {/* ORIGEN */}

                                    <td className="px-5 py-3">

                                        {trigger ? (

                                            <span
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                                                    trigger.className
                                                )}
                                            >
                                                <TriggerIcon className="w-3 h-3" />
                                                {trigger.label}
                                            </span>

                                        ) : (

                                            <span className="text-muted-foreground text-xs">
                                                Sin información
                                            </span>

                                        )}

                                    </td>

                                    {/* AUTOMATIZACIÓN */}

                                    <td className="px-5 py-3 font-medium text-foreground/80 max-w-[220px] truncate">

                                        {contact.automations?.name ?? "-"}

                                    </td>

                                    {/* INTERACCIONES */}

                                    <td className="px-5 py-3">

                                        <span className="font-bold font-heading">
                                            {contact.total_triggers}
                                        </span>

                                    </td>

                                    {/* FECHA */}

                                    <td className="px-5 py-3 text-muted-foreground">
                                        {formatDate(contact.last_interaction_at)}
                                    </td>

                                </motion.tr>

                            );

                        })}

                    </tbody>

                </table>

                {/* SIN RESULTADOS */}

                {filtered.length === 0 && (

                    <div className="p-10 text-center">

                        <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />

                        <p className="text-sm font-semibold text-foreground">
                            No encontramos prospectos.
                        </p>

                        <p className="text-xs text-muted-foreground mt-1">
                            Cambia los filtros o intenta otra búsqueda.
                        </p>

                    </div>

                )}

            </div>

        </div>
    );
}

// COMPONENTE DE ESTADÍSTICAS

function StatCard({
    title,
    value,
    icon: Icon,
    description
}: {
    title: string;
    value: number;
    icon: React.ElementType;
    description: string;
}) {

    return (

        <div className="bg-card border border-border rounded-xl p-4">

            <div className="flex items-center justify-between mb-3">

                <span className="text-xs font-medium text-muted-foreground">
                    {title}
                </span>

                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                </div>

            </div>

            <div className="text-2xl font-heading font-bold text-foreground">
                {value.toLocaleString("es-PE")}
            </div>

            <p className="text-[10px] text-muted-foreground mt-1">
                {description}
            </p>

        </div>

    );
}