"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Rocket, ArrowLeft, Package, Sparkles, Home, Utensils, ShoppingBag, Stethoscope, Briefcase, Wand2, Armchair, Hotel, Tent, Music, Scissors, Dumbbell, Wrench, Scale, Dog, Shield, Settings, Activity, Pill } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createProject, generateDynamicPrompt } from "../../actions";
import { useRouter } from "next/navigation";

const TEMPLATES = [
  { id: "inmobiliaria", title: "Inmobiliaria", icon: <Home className="w-6 h-6 text-blue-500" />, description: "Agente experto en mostrar propiedades, filtrar clientes y agendar visitas.", prompt: "Eres un asesor inmobiliario experto. Tu objetivo es pre-calificar a los clientes y agendar visitas." },
  { id: "concesionaria", title: "Concesionaria", icon: <Rocket className="w-6 h-6 text-sky-500" />, description: "Asesor virtual de ventas. Perfila clientes y agenda visitas o Test Drives.", prompt: "Eres un Asesor de Ventas Automotriz. Tu objetivo es perfilar al cliente y agendar un Test Drive." },
  { id: "muebleria", title: "Mueblería", icon: <Armchair className="w-6 h-6 text-amber-600" />, description: "Vende muebles, asesora en medidas y cierra ventas online.", prompt: "Eres asesor en mueblería. Informa medidas, materiales y cierra la venta." },
  { id: "clinica", title: "Clínica Médica", icon: <Stethoscope className="w-6 h-6 text-red-500" />, description: "Recepcionista que agenda turnos según especialidad y obra social.", prompt: "Eres recepcionista de una clínica. Agenda turnos y deriva urgencias." },
  { id: "hoteleria", title: "Hotelería", icon: <Hotel className="w-6 h-6 text-indigo-500" />, description: "Asiste huéspedes, informa disponibilidad y toma reservas.", prompt: "Eres recepcionista de hotel. Informa disponibilidad y toma reservas." },
  { id: "cabanas", title: "Cabañas / Turismo", icon: <Tent className="w-6 h-6 text-emerald-600" />, description: "Responde dudas, informa comodidades y cierra reservas temporales.", prompt: "Eres anfitrión de un complejo de cabañas. Informa disponibilidad y toma reservas." },
  { id: "discoteca", title: "Discoteca / Boliche", icon: <Music className="w-6 h-6 text-purple-600" />, description: "Reserva mesas VIP, listas de cumpleaños y vende entradas.", prompt: "Eres RR.PP de una discoteca. Gestiona listas, mesas VIP y entradas." },
  { id: "restaurante", title: "Restaurante / Delivery", icon: <Utensils className="w-6 h-6 text-orange-500" />, description: "Toma pedidos, envía menú y gestiona reservas de mesa.", prompt: "Eres camarero virtual. Toma pedidos de delivery o reservas de mesa." },
  { id: "ecommerce", title: "E-commerce", icon: <ShoppingBag className="w-6 h-6 text-pink-500" />, description: "Vendedor 24/7. Responde talles, envíos y manda links de pago.", prompt: "Eres vendedor online. Ayuda con talles, envíos y manda links de pago." },
  { id: "agencia", title: "Agencia Marketing", icon: <Briefcase className="w-6 h-6 text-slate-800" />, description: "Cualifica leads B2B y agenda videollamadas con expertos.", prompt: "Eres SDR de una agencia. Cualifica leads B2B y agenda videollamadas." },
  { id: "peluqueria", title: "Peluquería / Barbería", icon: <Scissors className="w-6 h-6 text-zinc-500" />, description: "Agenda turnos rápidamente y asesora sobre servicios.", prompt: "Eres asistente de peluquería. Agenda turnos y asesora sobre precios." },
  { id: "gimnasio", title: "Gimnasio", icon: <Dumbbell className="w-6 h-6 text-gray-700" />, description: "Informa planes, horarios de clases e inscribe alumnos.", prompt: "Eres recepcionista de gimnasio. Informa planes y motiva a inscribirse." },
  { id: "taller", title: "Taller Mecánico", icon: <Wrench className="w-6 h-6 text-yellow-600" />, description: "Coordina turnos para revisión y presupuesta arreglos.", prompt: "Eres jefe de taller. Coordina turnos y presupuesta revisiones." },
  { id: "abogados", title: "Estudio Abogados", icon: <Scale className="w-6 h-6 text-stone-600" />, description: "Recaba datos del caso y agenda asesorías iniciales.", prompt: "Eres asistente legal. Recaba datos confidenciales y agenda consultas." },
  { id: "veterinaria", title: "Veterinaria", icon: <Dog className="w-6 h-6 text-orange-400" />, description: "Agenda turnos de atención y peluquería canina.", prompt: "Eres asistente veterinario. Agenda turnos clínicos o de peluquería." },
  { id: "seguros", title: "Seguros", icon: <Shield className="w-6 h-6 text-blue-700" />, description: "Pide datos para cotizar pólizas y asiste en siniestros.", prompt: "Eres productor de seguros. Pide datos para cotizar pólizas." },
  { id: "repuestos", title: "Repuestos", icon: <Settings className="w-6 h-6 text-gray-500" />, description: "Consulta compatibilidad de piezas y vende autopartes.", prompt: "Eres vendedor de repuestos. Consulta modelos y cierra ventas." },
  { id: "estetica", title: "Estética y Spa", icon: <Activity className="w-6 h-6 text-rose-400" />, description: "Vende paquetes corporales y agenda turnos.", prompt: "Eres asesor de centro de estética. Vende paquetes y agenda sesiones." },
  { id: "farmacia", title: "Farmacia", icon: <Pill className="w-6 h-6 text-teal-500" />, description: "Toma pedidos, pide recetas y asesora sobre marcas.", prompt: "Eres farmacéutico virtual. Toma pedidos y solicita recetas si corresponde." },
  { id: "servicio_tecnico", title: "Servicio Técnico", icon: <Wrench className="w-6 h-6 text-cyan-600" />, description: "Pre-cotiza reparaciones y recibe equipos para revisión.", prompt: "Eres técnico de reparaciones. Pre-cotiza arreglos de PC/Celulares." },
  { id: "custom", title: "Crear desde cero", icon: <Wand2 className="w-6 h-6 text-slate-500" />, description: "Usa Inteligencia Artificial para generar un prompt a medida.", prompt: "" }
];

export default function NewProjectPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("templates");
  
  const [industry, setIndustry] = useState("");
  const [projectName, setProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [capabilities, setCapabilities] = useState({
    ventas: false,
    turnos: false,
    soporte: false,
    cobros: false
  });

  const [businessHours, setBusinessHours] = useState("");
  const [visitDuration, setVisitDuration] = useState("");

  const handleTemplateSelect = (templateId: string) => {
    const t = TEMPLATES.find(x => x.id === templateId);
    if (t) {
      setSelectedTemplate(t.id);
      setIndustry(t.title);
      setSystemPrompt(t.prompt);
      if (t.id !== "custom") {
        setActiveTab("data");
      }
    }
  };

  const handleCapabilityChange = (key: keyof typeof capabilities) => {
    setCapabilities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGeneratePrompt = async () => {
    if (!industry) {
      setMessage("Error: Escribe un rubro primero.");
      return;
    }
    const selectedCaps = [];
    if (capabilities.ventas) selectedCaps.push("Vender productos y consultar catálogo");
    if (capabilities.turnos) selectedCaps.push("Agendar turnos o reservas");
    if (capabilities.soporte) selectedCaps.push("Soporte técnico y preguntas frecuentes");
    if (capabilities.cobros) selectedCaps.push("Generar links de pago y verificar cobros");

    setIsGenerating(true);
    setMessage("");
    try {
      const res = await generateDynamicPrompt(industry, selectedCaps);
      if (res.success && res.prompt) {
        setSystemPrompt(res.prompt);
      } else {
        setMessage("Error al generar prompt: " + res.error);
      }
    } catch (e: any) {
      setMessage("Error: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeploy = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("project_name", projectName);
    formData.append("industry", industry);
    
    const selectedCaps: string[] = [];
    if (capabilities.ventas) selectedCaps.push("ventas");
    if (capabilities.turnos) selectedCaps.push("turnos");
    if (capabilities.soporte) selectedCaps.push("soporte");
    if (capabilities.cobros) selectedCaps.push("cobros");
    
    selectedCaps.forEach(cap => formData.append("capabilities", cap));

    let finalPrompt = systemPrompt;
    if (businessHours.trim()) {
      finalPrompt += `\n\nREGLAS DE HORARIOS:\n- Horarios de atención: ${businessHours.trim()}`;
    }
    if ((selectedTemplate === 'inmobiliaria' || selectedTemplate === 'concesionaria') && visitDuration.trim()) {
      finalPrompt += `\n- Duración de la visita/turno: ${visitDuration.trim()} minutos.`;
    }

    startTransition(async () => {
      const result = await createProject(formData, finalPrompt, selectedCaps);
      if (result.success) {
        setMessage("¡Agente creado exitosamente en Supabase!");
        setTimeout(() => router.push("/projects"), 1000);
      } else {
        setMessage(`Error: ${result.error}`);
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar minimalista */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Bot className="w-6 h-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">Panel Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </Link>
        </nav>
      </aside>

      <main className="flex-1 overflow-auto bg-muted/30">
        <header className="h-16 flex items-center px-8 border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
          <h1 className="text-xl font-semibold">Crear Nuevo Agente</h1>
        </header>

        <div className="p-8 max-w-4xl mx-auto space-y-8">
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-14 items-center">
              <TabsTrigger value="templates" className="text-base h-10">1. Elegir Plantilla</TabsTrigger>
              <TabsTrigger value="data" className="text-base h-10">2. Datos Básicos</TabsTrigger>
              <TabsTrigger value="personality" className="text-base h-10">3. Personalidad IA</TabsTrigger>
            </TabsList>

            {/* PASO 1: MARKETPLACE DE PLANTILLAS */}
            <TabsContent value="templates" className="mt-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Marketplace de Agentes</h2>
                <p className="text-muted-foreground">Selecciona una plantilla preconfigurada para acelerar el despliegue de tu bot de IA.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TEMPLATES.map((tpl) => (
                  <Card 
                    key={tpl.id} 
                    className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${selectedTemplate === tpl.id ? 'border-primary ring-2 ring-primary/20' : ''}`}
                    onClick={() => handleTemplateSelect(tpl.id)}
                  >
                    <CardContent className="p-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                        {tpl.icon}
                      </div>
                      <h3 className="font-bold text-lg mb-2">{tpl.title}</h3>
                      <p className="text-sm text-muted-foreground">{tpl.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* PASO 2: DATOS BÁSICOS */}
            <TabsContent value="data" className="mt-6">
              <Card className="border-border/50 bg-card/40 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle>Datos del Proyecto</CardTitle>
                  <CardDescription>Configura los parámetros iniciales de tu agente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Nombre del Agente</Label>
                    <Input 
                      id="projectName" 
                      placeholder="Ej: Asistente Ventas AutoCity" 
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Rubro / Industria (Se auto-rellenó por la plantilla)</Label>
                    <Input 
                      id="industry" 
                      placeholder="Ej: Inmobiliaria, Clínica Dental, etc." 
                      value={industry}
                      onChange={e => setIndustry(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="businessHours">Horarios de Atención</Label>
                      <Input 
                        id="businessHours" 
                        placeholder="Ej: Lun a Vie 09:00 a 18:00" 
                        value={businessHours}
                        onChange={e => setBusinessHours(e.target.value)}
                      />
                    </div>
                    {(selectedTemplate === 'inmobiliaria' || selectedTemplate === 'concesionaria') && (
                      <div className="space-y-2">
                        <Label htmlFor="visitDuration">Duración de visita (minutos)</Label>
                        <Input 
                          id="visitDuration" 
                          type="number"
                          placeholder="Ej: 60" 
                          value={visitDuration}
                          onChange={e => setVisitDuration(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <Label className="text-base font-semibold">¿Qué capacidades tendrá este agente?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={capabilities.ventas} onChange={() => handleCapabilityChange("ventas")} />
                        <div>
                          <p className="font-medium">Ventas y Catálogo</p>
                          <p className="text-xs text-muted-foreground">Puede ofrecer productos y precios.</p>
                        </div>
                      </label>
                      <label className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={capabilities.turnos} onChange={() => handleCapabilityChange("turnos")} />
                        <div>
                          <p className="font-medium">Agendar Turnos</p>
                          <p className="text-xs text-muted-foreground">Conecta con Google Calendar o similar.</p>
                        </div>
                      </label>
                      <label className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={capabilities.soporte} onChange={() => handleCapabilityChange("soporte")} />
                        <div>
                          <p className="font-medium">Soporte al Cliente</p>
                          <p className="text-xs text-muted-foreground">Responde FAQs y reclamos.</p>
                        </div>
                      </label>
                      <label className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={capabilities.cobros} onChange={() => handleCapabilityChange("cobros")} />
                        <div>
                          <p className="font-medium">Cobros (SaaS)</p>
                          <p className="text-xs text-muted-foreground">Genera links de MercadoPago.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <Button onClick={() => setActiveTab("personality")} className="w-full">
                    Siguiente: Configurar Personalidad
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PASO 3: PERSONALIDAD Y DESPLIEGUE */}
            <TabsContent value="personality" className="mt-6">
              <Card className="border-border/50 bg-card/40 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle>Personalidad (System Prompt)</CardTitle>
                  <CardDescription>
                    Este es el "cerebro" de tu bot. Puedes usar el prompt de la plantilla, editarlo, o dejar que la IA genere uno nuevo basado en tu rubro.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  <div className="flex gap-2">
                    <Button onClick={handleGeneratePrompt} disabled={isGenerating} variant="outline" className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200">
                      <Sparkles className="w-4 h-4 mr-2" />
                      {isGenerating ? "Generando..." : "Autogenerar con IA Avanzada"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="systemPrompt">Instrucciones del Agente (System Prompt)</Label>
                    <textarea 
                      id="systemPrompt" 
                      className="w-full h-48 p-3 bg-background border border-input rounded-md text-sm"
                      placeholder="Ej: Eres un asistente virtual amigable. Tu tarea es saludar al usuario..."
                      value={systemPrompt}
                      onChange={e => setSystemPrompt(e.target.value)}
                    ></textarea>
                    <p className="text-xs text-muted-foreground">Escribe las reglas que el bot deberá obedecer en cada conversación (Tono, Restricciones, Objetivos).</p>
                  </div>

                  {message && (
                    <div className={`p-4 rounded-md ${message.includes("Error") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                      {message}
                    </div>
                  )}

                  <form onSubmit={handleDeploy}>
                    <Button type="submit" disabled={isPending} className="w-full h-12 text-lg shadow-lg">
                      <Rocket className="w-5 h-5 mr-2" />
                      {isPending ? "Desplegando en la Nube..." : "Desplegar Agente Ahora"}
                    </Button>
                  </form>

                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

        </div>
      </main>
    </div>
  );
}
