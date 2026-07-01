import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, ChevronRight, MessageSquare, Zap, CreditCard, Shield, Rocket, Sparkles, CalendarClock, Handshake, Globe, Code2, CheckCircle2, BrainCircuit } from "lucide-react";
import Link from "next/link";
import { getCurrentAgency } from "./actions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LanguageSelector } from "@/components/language-selector";
import { Badge } from "@/components/ui/badge";
import { FadeIn, PhoneMockup, ChatBubble } from "./landing-animations";

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const agency = await getCurrentAgency();
  const t = await getDictionary();

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground flex flex-col font-sans selection:bg-primary/20 overflow-x-hidden">
      
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen opacity-50" />
      </div>

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-6 lg:px-12 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50 bg-[#09090b]/80">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Delphine <span className="text-primary">AI</span></span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium text-zinc-300">
            <Link href="#features" className="hover:text-white transition-colors">Funciones</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Precios</Link>
            <Link href="#faq" className="hover:text-white transition-colors">FAQ</Link>
          </div>
          <LanguageSelector />
          {agency ? (
            <Link href={agency.role === "superadmin" ? "/admin/agencies" : "/projects"}>
              <Button className="rounded-full px-6 shadow-md hover:shadow-lg transition-all bg-white text-zinc-900 hover:bg-zinc-200">
                {t.landing?.go_to_panel || "Ir a mi Panel"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" className="rounded-full px-6 hidden sm:inline-flex text-zinc-300 hover:text-white hover:bg-white/5">
                  {t.landing?.login || "Iniciar Sesión"}
                </Button>
              </Link>
              <Link href="/login">
                <Button className="rounded-full px-6 shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-primary to-blue-600 text-white border-0">
                  {t.landing?.start_free || "Comenzar"}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              
              <FadeIn direction="right" className="flex flex-col justify-center text-center lg:text-left space-y-8">
                <Badge variant="outline" className="w-fit mx-auto lg:mx-0 px-4 py-1.5 rounded-full border-blue-500/30 bg-blue-500/10 text-blue-400 backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 mr-2 text-blue-400" />
                  El futuro de la atención al cliente
                </Badge>
                
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
                  Vende en automático <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-purple-500">
                    mientras duermes.
                  </span>
                </h1>
                
                <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Conecta tu WhatsApp a una Inteligencia Artificial que cobra, agenda turnos, responde dudas y cierra ventas las 24 horas del día. Diseñado para empresas modernas.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
                  <Link href="/login">
                    <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base font-semibold rounded-full shadow-[0_0_40px_rgba(37,99,235,0.3)] bg-white text-zinc-900 hover:bg-zinc-200 transition-all hover:scale-105">
                      Comienza Gratis Ahora
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                  <div className="text-sm text-zinc-500 flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> No requiere tarjeta de crédito
                  </div>
                </div>
              </FadeIn>

              <FadeIn direction="left" delay={0.2} className="relative hidden md:block">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-3xl -z-10 transform translate-x-20"></div>
                <PhoneMockup>
                  <ChatBubble text="Hola, ¿tienen turnos para hoy a la tarde?" isBot={false} delay={0.5} />
                  <ChatBubble text="¡Hola! Sí, tengo un turno disponible a las 17:30 y otro a las 18:00. ¿Cuál prefieres?" isBot={true} delay={1.5} />
                  <ChatBubble text="A las 18:00 está perfecto." isBot={false} delay={3} />
                  <ChatBubble text="¡Turno agendado para las 18:00! Te envío el link de MercadoPago para abonar la seña: https://link.mercadopago.com.ar/delphine" isBot={true} delay={4.5} />
                </PhoneMockup>
              </FadeIn>

            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="py-12 border-y border-white/5 bg-white/[0.02]">
          <div className="container px-4 mx-auto text-center">
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-8">Tecnologías y Plataformas Integradas</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              <span className="text-xl font-bold text-white flex items-center"><MessageSquare className="mr-2" /> WhatsApp API</span>
              <span className="text-xl font-bold text-white flex items-center"><CreditCard className="mr-2" /> Mercado Pago</span>
              <span className="text-xl font-bold text-white flex items-center"><Shield className="mr-2" /> ARCA / AFIP</span>
              <span className="text-xl font-bold text-white flex items-center"><BrainCircuit className="mr-2" /> Gemini 2.5 Flash</span>
            </div>
          </div>
        </section>

        {/* BENTO GRID (FEATURES) */}
        <section id="features" className="py-24 lg:py-32 relative">
          <div className="container px-4 md:px-6 mx-auto">
            <FadeIn className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white tracking-tight">
                Todo lo que necesitas, <br/><span className="text-zinc-500">en una sola caja de herramientas.</span>
              </h2>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              
              <FadeIn delay={0.1} className="md:col-span-2 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl p-8 overflow-hidden relative group hover:border-primary/50 transition-colors">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-primary/20 blur-3xl rounded-full group-hover:bg-primary/30 transition-colors"></div>
                <Zap className="w-10 h-10 text-primary mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">Cobros Automáticos</h3>
                <p className="text-zinc-400 text-lg max-w-md">La IA genera links de Mercado Pago dinámicos en medio de la conversación, verifica si el pago ingresó, y emite la factura electrónica en AFIP sin que muevas un dedo.</p>
              </FadeIn>

              <FadeIn delay={0.2} className="md:col-span-1 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl p-8 hover:border-blue-500/50 transition-colors">
                <CalendarClock className="w-10 h-10 text-blue-500 mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">Agenda 24/7</h3>
                <p className="text-zinc-400">Lee tu disponibilidad y agenda citas directamente. Adiós a los mensajes de "pasame horarios".</p>
              </FadeIn>

              <FadeIn delay={0.3} className="md:col-span-1 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl p-8 hover:border-emerald-500/50 transition-colors">
                <Handshake className="w-10 h-10 text-emerald-500 mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">Handoff Omnicanal</h3>
                <p className="text-zinc-400">Si un cliente se enoja, la IA se pausa sola y te avisa para que intervengas desde el Live Chat.</p>
              </FadeIn>

              <FadeIn delay={0.4} className="md:col-span-2 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full group-hover:bg-purple-500/20 transition-colors"></div>
                <Code2 className="w-10 h-10 text-purple-500 mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">Marca Blanca para Agencias (Resellers)</h3>
                <p className="text-zinc-400 text-lg max-w-lg">Sube tu logo, conecta tu propio dominio y revende nuestra tecnología al precio que quieras. Tus clientes nunca sabrán que existimos.</p>
              </FadeIn>
              
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" className="py-24 bg-black relative border-t border-white/5">
          <div className="container px-4 md:px-6 mx-auto">
            <FadeIn className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">Planes diseñados para escalar</h2>
              <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                Desde pequeños consultorios hasta agencias de automatización globales.
              </p>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              
              {/* Starter */}
              <FadeIn delay={0.1}>
                <Card className="flex flex-col bg-zinc-900/50 border-white/10 h-full hover:border-white/20 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">Starter</CardTitle>
                    <div className="text-3xl font-bold text-white mt-2">$39.99<span className="text-base font-normal text-zinc-500">/mes (USD)</span></div>
                    <CardDescription className="mt-2">Ideal para independientes</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3 text-sm text-zinc-400">
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> 1 Agente de IA</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> 500 mensajes/mes</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Soporte básico</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white hover:text-black">Prueba de 3 días</Button>
                  </CardFooter>
                </Card>
              </FadeIn>

              {/* Growth */}
              <FadeIn delay={0.2}>
                <Card className="flex flex-col bg-gradient-to-b from-primary/20 to-zinc-900/50 border-primary/50 shadow-[0_0_30px_rgba(37,99,235,0.15)] h-full relative overflow-hidden transform md:-translate-y-4">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-blue-400"></div>
                  <CardHeader>
                    <Badge className="w-fit mb-2 bg-blue-600 text-white hover:bg-blue-600">El más elegido</Badge>
                    <CardTitle className="text-xl text-white">Growth</CardTitle>
                    <div className="text-3xl font-bold text-white mt-2">$149.99<span className="text-base font-normal text-zinc-400">/mes (USD)</span></div>
                    <CardDescription className="mt-2">Para PyMEs que venden</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3 text-sm text-zinc-300">
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> 3 Agentes de IA</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> 2,000 mensajes/mes</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Cobros Mercado Pago</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Facturación AFIP</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0">Comenzar</Button>
                  </CardFooter>
                </Card>
              </FadeIn>

              {/* Reseller Pro */}
              <FadeIn delay={0.3}>
                <Card className="flex flex-col bg-zinc-900/50 border-white/10 h-full hover:border-purple-500/30 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">Reseller Pro</CardTitle>
                    <div className="text-3xl font-bold text-white mt-2">$340<span className="text-base font-normal text-zinc-500">/mes (USD)</span></div>
                    <CardDescription className="mt-2">Crea tu propia agencia</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3 text-sm text-zinc-400">
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-purple-500" /> 10 Agentes de IA</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-purple-500" /> Panel Marca Blanca</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-purple-500" /> Dominio Personalizado</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-purple-500" /> Vende a tu precio</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white hover:text-black">Prueba de 3 días</Button>
                  </CardFooter>
                </Card>
              </FadeIn>

              {/* Agency Master */}
              <FadeIn delay={0.4}>
                <Card className="flex flex-col bg-zinc-900/50 border-white/10 h-full hover:border-emerald-500/30 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">Agency Master</CardTitle>
                    <div className="text-3xl font-bold text-white mt-2">$1399<span className="text-base font-normal text-zinc-500">/mes (USD)</span></div>
                    <CardDescription className="mt-2">Escala sin límites</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3 text-sm text-zinc-400">
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> 50 Agentes de IA</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> 50,000 mensajes/mes</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> API Access</li>
                      <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Soporte Prioritario 24/7</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white hover:text-black">Contactar Ventas</Button>
                  </CardFooter>
                </Card>
              </FadeIn>

            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-[#09090b]">
        <div className="container px-4 md:px-6 mx-auto flex flex-col md:flex-row justify-between items-center text-zinc-500">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-semibold text-zinc-300">Delphine AI</span>
          </div>
          <p className="text-sm">© 2026 Delphine. Todos los derechos reservados.</p>
          <div className="flex space-x-4 mt-4 md:mt-0 text-sm">
            <Link href="#" className="hover:text-white transition-colors">Términos</Link>
            <Link href="#" className="hover:text-white transition-colors">Privacidad</Link>
            <Link href="#" className="hover:text-white transition-colors">Soporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
