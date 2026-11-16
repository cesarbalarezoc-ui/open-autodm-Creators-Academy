"use client";

import Image from "next/image";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Zap,
  Users,
  ChartNoAxesCombined,
  Instagram,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Workflow,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { LogoMark, LogoWordmark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const features = [
  {
    icon: Workflow,
    number: "01",
    title: "Automatización inteligente",
    description:
      "Responde comentarios y activa conversaciones de Instagram de forma automática.",
    color: "from-blue-500 to-cyan-400",
  },
  {
    icon: Users,
    number: "02",
    title: "CRM de contactos",
    description:
      "Organiza tus contactos, consulta sus conversaciones y administra tus oportunidades.",
    color: "from-violet-500 to-fuchsia-400",
  },
  {
    icon: ChartNoAxesCombined,
    number: "03",
    title: "Analíticas y resultados",
    description:
      "Visualiza el rendimiento de tus automatizaciones y sigue el crecimiento de tu actividad.",
    color: "from-cyan-400 to-blue-500",
  },
];

function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 35, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.25 }}
      className="relative w-full max-w-[540px]"
    >
      <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-blue-600/20 via-cyan-400/10 to-fuchsia-500/20 blur-3xl" />

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0D1428]/95 shadow-2xl shadow-blue-950/50 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Centro de control</p>
              <p className="text-[10px] text-slate-500">PROSPECTOR AI</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Sistema preparado
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Automatizaciones</span>
              <Workflow className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-white">24</p>
            <p className="mt-1 text-[10px] text-emerald-300">Panel de gestión</p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Contactos</span>
              <Users className="h-4 w-4 text-violet-400" />
            </div>
            <p className="text-3xl font-bold text-white">CRM</p>
            <p className="mt-1 text-[10px] text-slate-400">Gestión centralizada</p>
          </div>
        </div>

        <div className="mx-5 mb-5 rounded-2xl border border-white/[0.07] bg-[#111C35] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Flujo de automatización</p>
              <p className="mt-1 text-[10px] text-slate-500">Ejemplo visual del proceso</p>
            </div>
            <Sparkles className="h-5 w-5 text-cyan-400" />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-pink-400/20 bg-pink-400/[0.07] p-3">
              <Instagram className="mb-2 h-5 w-5 text-pink-400" />
              <span className="text-[10px] font-medium text-white">Instagram</span>
              <span className="mt-1 text-[9px] text-slate-500">Comentario</span>
            </div>

            <ArrowRight className="h-4 w-4 shrink-0 text-cyan-400" />

            <div className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-blue-400/20 bg-blue-400/[0.07] p-3">
              <Zap className="mb-2 h-5 w-5 text-blue-400" />
              <span className="text-[10px] font-medium text-white">Automatización</span>
              <span className="mt-1 text-[9px] text-slate-500">Activación</span>
            </div>

            <ArrowRight className="h-4 w-4 shrink-0 text-cyan-400" />

            <div className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3">
              <MessageCircle className="mb-2 h-5 w-5 text-emerald-400" />
              <span className="text-[10px] font-medium text-white">Mensaje</span>
              <span className="mt-1 text-[9px] text-slate-500">Respuesta</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-4">
          <span className="text-[10px] text-slate-500">CREATORS ACADEMY PRO</span>
          <span className="flex items-center gap-1 text-[10px] text-cyan-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acceso protegido
          </span>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, -9, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-4 top-12 hidden items-center gap-2 rounded-xl border border-white/10 bg-[#17233D] px-4 py-3 shadow-xl sm:flex"
      >
        <div className="rounded-lg bg-emerald-400/10 p-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-white">Más oportunidades</p>
          <p className="text-[9px] text-slate-400">Conecta con tu audiencia</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080B18] text-white selection:bg-cyan-400/30">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-[550px] w-[550px] rounded-full bg-blue-600/15 blur-[130px]" />
        <div className="absolute -right-48 top-40 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[130px]" />
        <div className="absolute bottom-[-250px] left-1/3 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #8295BC 1px, transparent 0)",
            backgroundSize: "34px 34px",
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <Image
            src="/creators-academy-pro-logo.png"
            alt="CREATORS ACADEMY PRO"
            width={180}
            height={60}
            priority
            className="h-16 w-auto object-contain"
          />
          <div className="h-8 w-px bg-white/15" />
          <LogoWordmark className="text-xs sm:text-sm" />
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setShowLogin(true)}
            className="hidden rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold text-white transition hover:border-cyan-400/60 hover:bg-white/5 sm:block"
          >
            Iniciar sesión
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!showLogin ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <section className="relative z-10 mx-auto grid min-h-[650px] w-full max-w-7xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-28 lg:pt-16">
              <div className="max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] px-4 py-2"
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    Tu centro de crecimiento digital
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[62px]"
                >
                  Transforma tus interacciones en{" "}
                  <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent">
                    oportunidades de venta.
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mt-7 max-w-xl text-sm leading-7 text-slate-400 sm:text-base"
                >
                  Gestiona tus automatizaciones de Instagram, organiza tus
                  contactos y analiza tus resultados desde una sola plataforma.
                  Bienvenido a PROSPECTOR AI.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center"
                >
                  <button
                    onClick={() => setShowLogin(true)}
                    className="group flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition duration-300 hover:-translate-y-1 hover:shadow-cyan-500/25"
                  >
                    ACCEDER A LA PLATAFORMA
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                  <span className="flex items-center justify-center gap-2 text-xs text-slate-500 sm:justify-start">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Plataforma de acceso privado
                  </span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/[0.08] pt-7"
                >
                  {["Automatiza", "Organiza", "Analiza"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                      {item}
                    </div>
                  ))}
                </motion.div>
              </div>

              <div className="flex items-center justify-center py-6 lg:py-0">
                <DashboardPreview />
              </div>
            </section>

            <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-24 lg:px-10">
              <div className="mb-10 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
                  Todo en un solo lugar
                </p>
                <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                  Herramientas para crecer
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
                  Administra tu actividad digital con herramientas diseñadas
                  para simplificar tu trabajo.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={feature.number}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-7 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/25 hover:bg-white/[0.045]"
                    >
                      <div className="mb-7 flex items-center justify-between">
                        <div className={`rounded-xl bg-gradient-to-br ${feature.color} p-[1px]`}>
                          <div className="rounded-xl bg-[#10172B] p-3">
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <span className="text-xs font-semibold tracking-widest text-slate-600">
                          {feature.number}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {feature.description}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            <footer className="relative z-10 border-t border-white/[0.07] px-6 py-7 text-center">
              <p className="text-[10px] font-medium tracking-[0.16em] text-slate-500">
                PROSPECTOR AI · CREATORS ACADEMY PRO
              </p>
              <p className="mt-2 text-[10px] text-slate-600">
                Plataforma privada de automatización y gestión digital.
              </p>
            </footer>
          </motion.div>
        ) : (
          <motion.section
            key="login"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 flex min-h-[75vh] flex-col items-center justify-center px-5 py-12"
          >
            <button
              onClick={() => setShowLogin(false)}
              className="mb-7 flex items-center gap-2 self-center text-xs font-medium text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la portada
            </button>

            <div className="mb-7 text-center">
              <div className="mb-5 flex justify-center">
                <Image
                  src="/creators-academy-pro-logo.png"
                  alt="CREATORS ACADEMY PRO"
                  width={240}
                  height={80}
                  priority
                  className="h-16 w-auto object-contain"
                />
              </div>
              <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300">
                PROSPECTOR AI
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">
                Bienvenido de nuevo
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Ingresa tus credenciales para continuar.
              </p>
            </div>

            <div className="w-full max-w-[420px]">
              <LoginForm />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
