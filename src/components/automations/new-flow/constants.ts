export const AUTOMATION_TYPES = [
    {
        id: "comment-dm",
        name: "Comentario a mensaje directo",
        description: "Envía mensajes directos automáticamente a quienes comenten tus publicaciones o reels.",
        iconType: "message",
        available: true,
        bg: "from-[#F97316]/20 to-[#fc9c54]/10",
        border: "group-hover:border-[#F97316]/50",
        iconColor: "text-[#F97316]"
    },
    {
        id: "dm-reply",
        name: "Respuesta automática por mensaje",
        description: "Responde automáticamente cuando alguien envíe palabras clave por mensaje directo.",
        iconType: "send",
        available: true,
        bg: "from-blue-500/20 to-indigo-500/10",
        border: "group-hover:border-blue-500/50",
        iconColor: "text-blue-500"
    },
    {
        id: "story-reply",
        name: "Respuesta a historias",
        description: "Envía una respuesta automática cuando alguien responda a tu historia.",
        iconType: "image",
        available: true,
        bg: "from-green-500/20 to-emerald-500/10",
        border: "group-hover:border-green-500/50",
        iconColor: "text-green-500"
    },
    {
        id: "story-mention",
        name: "Mención en historias",
        description: "Premia a tus seguidores cuando te mencionen en sus historias.",
        iconType: "at-sign",
        available: false,
        bg: "from-muted/20 to-muted/10",
        border: "border-border/50",
        iconColor: "text-muted-foreground"
    }
];
