"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Rocket, ArrowLeft, Package, Sparkles, Home, Utensils, ShoppingBag, Stethoscope, Briefcase, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createProject, generateDynamicPrompt } from "../../actions";
import { useRouter } from "next/navigation";

const TEMPLATES = [
  {
    id: "inmobiliaria",
    title: "Inmobiliaria",
    icon: <Home className="w-6 h-6 text-blue-500" />,
    description: "Agente experto en mostrar propiedades, filtrar clientes y agendar visitas.",
    prompt: "Eres un asesor inmobiliario experto. Tu objetivo es pre-calificar a los clientes preguntando su presupuesto y zona de interés, y luego invitarlos a agendar una visita a la propiedad. Sé muy amable y profesional."
  },
  {
    id: "restaurante",
    title: "Restaurante / Delivery",
    icon: <Utensils className="w-6 h-6 text-orange-500" />,
    description: "Toma pedidos, envía el menú en PDF y responde horarios de atención.",
    prompt: "Eres el asistente virtual de un restaurante. Debes saludar, ofrecer el menú del día y tomar el pedido del cliente detalladamente. Si preguntan por horarios, diles que abren de 12hs a 23hs."
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    icon: <ShoppingBag className="w-6 h-6 text-emerald-500" />,
    description: "Vendedor 24/7. Responde dudas sobre envíos, talles y envia links de pago.",
    prompt: "Eres un vendedor de una tienda online. Debes ayudar a los clientes a elegir sus productos, explicarles que los envíos tardan 48hs y facilitarles el link de pago si desean concretar la compra."
  },
  {
    id: "clinica",
    title: "Clínica Médica",
    icon: <Stethoscope className="w-6 h-6 text-red-500" />,
    description: "Recepcionista virtual que agenda turnos y deriva urgencias.",
    prompt: "Eres la recepcionista de una clínica médica. Debes preguntar el DNI, obra social y especialidad que necesita el paciente para luego ofrecerle los turnos disponibles. Si es urgencia médica, diles que llamen al 911."
  },
  {
    id: "agencia",
    title: "Agencia de Marketing",
    icon: <Briefcase className="w-6 h-6 text-purple-500" />,
    description: "Cualifica leads B2B y agenda videollamadas comerciales.",
    prompt: "Eres un SDR (Representante de Desarrollo de Ventas) para una agencia de marketing. Tu objetivo es entender el dolor del negocio del prospecto y agendar una llamada de 15 minutos por Zoom con un experto."
  },
  {
    id: "concesionaria",
    title: "Concesionaria Automotor",
    icon: <Rocket className="w-6 h-6 text-sky-500" />,
    description: "Asesor virtual de ventas. Perfila clientes y agenda visitas o Test Drives.",
    prompt: "Eres un Asesor de Ventas Automotriz. Tu objetivo es perfilar al cliente, entusiasmarlo con los vehículos disponibles y lograr que agende un 'Test Drive' o visita presencial al local."
  },
  {
    id: "custom",
    title: "Crear desde cero",
    icon: <Wand2 className="w-6 h-6 text-slate-500" />,
    description: "Usa nuestra Inteligencia Artificial para generar un prompt totalmente a medida.",
    prompt: ""
  }
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
