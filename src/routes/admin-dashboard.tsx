import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isAdmin as isAdminFn,
  getAdminStats,
  listAllUsers,
  listAllStories,
  setUserRole,
  deleteStoryAdmin,
  deleteUserAdmin,
} from "@/lib/admin.functions";
import { getAiSettings, saveAiSettings, testAiConnection } from "@/lib/ai-settings.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarSeparator } from "@/components/ui/sidebar";
import { toast } from "sonner";
import {
  Loader2, Shield, Users, BookOpen, BookMarked, TrendingUp,
  Trash2, ArrowRight, ShieldCheck, ShieldOff, Search, KeyRound, Sparkles, CheckCircle2, XCircle,
  LayoutDashboard, Settings2, LogOut, Crown,
} from "lucide-react";

export const Route = createFileRoute("/admin-dashboard")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "داشبورد الأدمن المنفصل — AI Story" },
      { name: "description", content: "لوحة تحكم منفصلة لإدارة AI Story - المستخدمون والقصص وإعدادات الذكاء الاصطناعي" },
    ],
  }),
});

type View = "overview" | "users" | "stories" | "ai";

function AdminDashboard() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");

  const isAdminQuery = useServerFn(isAdminFn);
  const statsFn = useServerFn(getAdminStats);
  const usersFn = useServerFn(listAllUsers);
  const storiesFn = useServerFn(listAllStories);
  const setRoleFn = useServerFn(setUserRole);
  const delStoryFn = useServerFn(deleteStoryAdmin);
  const delUserFn = useServerFn(deleteUserAdmin);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { nav({ to: "/login" }); return; }
      setAuthChecked(true);
    });
  }, [nav]);

  const adminCheck = useQuery({ queryKey: ["isAdmin"], queryFn: () => isAdminQuery(), enabled: authChecked });
  const isAdminUser = adminCheck.data?.isAdmin === true;

  const stats = useQuery({ queryKey: ["adminStats"], queryFn: () => statsFn(), enabled: isAdminUser });
  const users = useQuery({ queryKey: ["adminUsers"], queryFn: () => usersFn(), enabled: isAdminUser });
  const stories = useQuery({ queryKey: ["adminStories"], queryFn: () => storiesFn(), enabled: isAdminUser });

  if (!authChecked || adminCheck.isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }
  if (!isAdminUser) {
    return (
      <main dir="rtl" className="min-h-screen grid place-items-center px-4 bg-muted/20">
        <Card className="p-8 text-center max-w-md space-y-4">
          <ShieldOff className="size-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">غير مسموح</h1>
          <p className="text-muted-foreground">هذه الصفحة متاحة للأدمن فقط. سجل دخول بحساب أدمن.</p>
          <div className="flex gap-2 justify-center">
            <Button asChild><Link to="/"><ArrowRight className="size-4 ml-1" /> الرئيسية</Link></Button>
            <Button asChild variant="outline"><Link to="/admin">الداشبورد القديم /admin</Link></Button>
          </div>
        </Card>
      </main>
    );
  }

  async function toggleAdmin(user_id: string, currentlyAdmin: boolean) {
    try {
      await setRoleFn({ data: { user_id, role: "admin", grant: !currentlyAdmin } });
      toast.success(currentlyAdmin ? "تم إلغاء صلاحية الأدمن" : "تم منح صلاحية الأدمن");
      qc.invalidateQueries({ queryKey: ["adminUsers"] });
      qc.invalidateQueries({ queryKey: ["adminStats"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل التحديث"); }
  }
  async function removeStory(id: string) {
    if (!confirm("حذف هذه القصة نهائياً؟")) return;
    try { await delStoryFn({ data: { id } }); toast.success("تم حذف القصة"); qc.invalidateQueries({ queryKey: ["adminStories"] }); qc.invalidateQueries({ queryKey: ["adminStats"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل الحذف"); }
  }
  async function removeUser(user_id: string) {
    if (!confirm("حذف هذا المستخدم وجميع بياناته نهائياً؟")) return;
    try { await delUserFn({ data: { user_id } }); toast.success("تم حذف المستخدم"); qc.invalidateQueries({ queryKey: ["adminUsers"] }); qc.invalidateQueries({ queryKey: ["adminStats"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل الحذف"); }
  }

  const filteredUsers = (users.data ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q);
  });
  const s = stats.data;

  return (
    <SidebarProvider dir="rtl">
      <Sidebar side="right" variant="inset" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="size-10 rounded-xl bg-primary grid place-items-center shrink-0">
              <Crown className="size-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-sm leading-none">AI Story</p>
              <p className="text-xs text-muted-foreground">داشبورد الأدمن المنفصل</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>القائمة</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={view==="overview"} onClick={()=>setView("overview")} tooltip="نظرة عامة">
                    <LayoutDashboard /> نظرة عامة
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={view==="users"} onClick={()=>setView("users")} tooltip="المستخدمون">
                    <Users /> المستخدمون {s?.users ? <Badge variant="secondary" className="mr-auto">{s.users}</Badge> : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={view==="stories"} onClick={()=>setView("stories")} tooltip="القصص">
                    <BookOpen /> القصص {s?.stories ? <Badge variant="secondary" className="mr-auto">{s.stories}</Badge> : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={view==="ai"} onClick={()=>setView("ai")} tooltip="إعدادات AI">
                    <Settings2 /> إعدادات الـ AI
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupLabel>روابط سريعة</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild><Link to="/"><ArrowRight className="size-4" /> العودة للموقع</Link></SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild><Link to="/admin"><Shield className="size-4" /> الداشبورد القديم /admin</Link></SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="p-2">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async()=>{await supabase.auth.signOut(); nav({to:"/login"})}}>
              <LogOut className="size-4 ml-2" /> تسجيل خروج
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4 bg-card/50 backdrop-blur sticky top-0 z-10">
          <SidebarTrigger />
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <h1 className="font-bold">
              {view==="overview" && "نظرة عامة"}
              {view==="users" && "إدارة المستخدمين"}
              {view==="stories" && "إدارة القصص"}
              {view==="ai" && "إعدادات الذكاء الاصطناعي"}
            </h1>
            <Badge variant="outline" className="mr-2 hidden sm:inline-flex">منفصل — /admin-dashboard</Badge>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex"><Link to="/">الموقع</Link></Button>
          </div>
        </header>

        <main dir="rtl" className="flex-1 p-4 md:p-6 bg-muted/20 min-h-[calc(100vh-3.5rem)]">
          {view==="overview" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard icon={Users} label="المستخدمون" value={s?.users} />
                <StatCard icon={ShieldCheck} label="أدمن" value={s?.admins} />
                <StatCard icon={BookOpen} label="إجمالي القصص" value={s?.stories} />
                <StatCard icon={TrendingUp} label="قصص اليوم" value={s?.storiesToday} />
                <StatCard icon={TrendingUp} label="قصص الشهر" value={s?.storiesThisMonth} />
                <StatCard icon={BookMarked} label="الكلمات" value={s?.vocabulary} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-5 space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><Sparkles className="size-4 text-primary" /> عن الداشبورد المنفصل</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    هذا داشبورد أدمن <b>منفصل تماماً</b> عن واجهة المستخدم العادية. له سايدبار وتخطيط مستقل على الرابط <code className="bg-muted px-1.5 py-0.5 rounded text-xs" dir="ltr">/admin-dashboard</code>.
                    الداشبورد القديم لا يزال متاح على <code className="bg-muted px-1.5 py-0.5 rounded text-xs" dir="ltr">/admin</code> للتوافق.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={()=>setView("users")}><Users className="size-4 ml-1" /> إدارة المستخدمين</Button>
                    <Button size="sm" variant="outline" onClick={()=>setView("ai")}><Settings2 className="size-4 ml-1" /> إعدادات AI</Button>
                  </div>
                </Card>
                <Card className="p-5 space-y-3">
                  <h3 className="font-bold">روابط مباشرة</h3>
                  <div className="grid gap-2 text-sm">
                    <Link to="/admin-dashboard" className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-accent transition"><span>الداشبورد المنفصل الجديد</span><Badge>/admin-dashboard</Badge></Link>
                    <Link to="/admin" className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-accent transition"><span>الداشبورد القديم</span><Badge variant="secondary">/admin</Badge></Link>
                    <Link to="/" className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-accent transition"><span>واجهة المستخدم</span><Badge variant="outline">/</Badge></Link>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {view==="users" && (
            <Card className="p-4 space-y-4 max-w-7xl mx-auto">
              <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="ابحث بالإيميل أو الاسم..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pr-10" />
              </div>
              {users.isLoading ? <div className="grid place-items-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-right border-b text-muted-foreground"><th className="py-2 px-2">المستخدم</th><th className="py-2 px-2">الإيميل</th><th className="py-2 px-2">الدور</th><th className="py-2 px-2">القصص</th><th className="py-2 px-2">التسجيل</th><th className="py-2 px-2">إجراءات</th></tr></thead>
                    <tbody>
                      {filteredUsers.map((u)=>{
                        const isAdm = u.roles.includes("admin");
                        return (
                          <tr key={u.user_id} className="border-b hover:bg-muted/30">
                            <td className="py-2 px-2 flex items-center gap-2"><div className="size-8 rounded-full overflow-hidden bg-muted shrink-0">{u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : null}</div><span className="font-medium">{u.display_name ?? "—"}</span></td>
                            <td className="py-2 px-2 text-muted-foreground" dir="ltr">{u.email}</td>
                            <td className="py-2 px-2">{isAdm ? <Badge>أدمن</Badge> : <Badge variant="secondary">مستخدم</Badge>}</td>
                            <td className="py-2 px-2">{u.stories_count}</td>
                            <td className="py-2 px-2 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("ar-EG")}</td>
                            <td className="py-2 px-2"><div className="flex gap-1"><Button size="sm" variant={isAdm ? "outline" : "default"} onClick={()=>toggleAdmin(u.user_id, isAdm)}>{isAdm ? <><ShieldOff className="size-3.5 ml-1" /> إلغاء</> : <><ShieldCheck className="size-3.5 ml-1" /> منح</>}</Button><Button size="sm" variant="destructive" onClick={()=>removeUser(u.user_id)}><Trash2 className="size-3.5" /></Button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredUsers.length===0 && <p className="text-center text-muted-foreground py-8">لا يوجد مستخدمون</p>}
                </div>
              )}
            </Card>
          )}

          {view==="stories" && (
            <Card className="p-4 max-w-7xl mx-auto">
              {stories.isLoading ? <div className="grid place-items-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-right border-b text-muted-foreground"><th className="py-2 px-2">العنوان</th><th className="py-2 px-2">الموضوع</th><th className="py-2 px-2">اللغة</th><th className="py-2 px-2">التاريخ</th><th className="py-2 px-2">إجراءات</th></tr></thead>
                    <tbody>
                      {(stories.data ?? []).map((st)=>(
                        <tr key={st.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-2 font-medium"><Link to="/story/$id" params={{id: st.id}} className="hover:underline">{st.title}</Link></td>
                          <td className="py-2 px-2">{st.topic}</td>
                          <td className="py-2 px-2">{st.language==="ar" ? "عربي" : "English"}</td>
                          <td className="py-2 px-2 text-xs text-muted-foreground">{new Date(st.created_at).toLocaleDateString("ar-EG")}</td>
                          <td className="py-2 px-2"><Button size="sm" variant="destructive" onClick={()=>removeStory(st.id)}><Trash2 className="size-3.5" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(stories.data ?? []).length===0 && <p className="text-center text-muted-foreground py-8">لا توجد قصص</p>}
                </div>
              )}
            </Card>
          )}

          {view==="ai" && (
            <div className="max-w-3xl mx-auto">
              <AiSettingsPanel />
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | undefined }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-primary" />
        <span className="text-2xl font-bold">{value ?? "—"}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
    </Card>
  );
}

const MODEL_PRESETS: Record<string, { label: string; models: { id: string; name: string }[] }> = {
  lovable: { label: "Lovable AI (افتراضي — لا يحتاج مفتاح)", models: [{ id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },{ id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },{ id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },{ id: "openai/gpt-5-mini", name: "GPT-5 Mini" },{ id: "openai/gpt-5", name: "GPT-5" }] },
  openai: { label: "OpenAI (مفتاحك الخاص)", models: [{ id: "gpt-4o-mini", name: "GPT-4o Mini" },{ id: "gpt-4o", name: "GPT-4o" },{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },{ id: "gpt-4.1", name: "GPT-4.1" }] },
  gemini: { label: "Google Gemini (مفتاحك الخاص)", models: [{ id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" }] },
  custom: { label: "مزوّد مخصص (OpenAI-Compatible)", models: [] },
};

function AiSettingsPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAiSettings);
  const saveFn = useServerFn(saveAiSettings);
  const testFn = useServerFn(testAiConnection);
  const settings = useQuery({ queryKey: ["aiSettings"], queryFn: () => getFn() });
  const [provider, setProvider] = useState<"lovable" | "openai" | "gemini" | "custom">("lovable");
  const [model, setModel] = useState("google/gemini-2.5-flash");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  useEffect(()=>{ if(settings.data){ setProvider(settings.data.provider); setModel(settings.data.model); setBaseUrl(settings.data.base_url ?? ""); } },[settings.data]);
  async function save(){ setSaving(true); try{ await saveFn({data:{provider, model, base_url: baseUrl || null}}); toast.success("تم حفظ الإعدادات"); qc.invalidateQueries({queryKey:["aiSettings"]}); }catch(e){ toast.error(e instanceof Error ? e.message : "فشل الحفظ"); }finally{ setSaving(false); } }
  async function test(){ setTesting(true); setTestResult(null); try{ const res=await testFn(); if(res.ok){ setTestResult({ok:true, msg:`✓ ${res.provider} · ${res.modelId} → ${res.reply}`}); toast.success("الاتصال يعمل بنجاح"); } else { setTestResult({ok:false, msg: res.error ?? "فشل"}); toast.error("فشل الاتصال"); } }catch(e){ const msg=e instanceof Error ? e.message : "خطأ"; setTestResult({ok:false, msg}); toast.error(msg); }finally{ setTesting(false); } }
  if(settings.isLoading) return <div className="grid place-items-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  const presets = MODEL_PRESETS[provider];
  const keyPresent = settings.data?.key_present;
  const needsKey = provider !== "lovable";
  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start gap-3"><div className="size-10 rounded-2xl bg-primary/10 grid place-items-center shrink-0"><Sparkles className="size-5 text-primary" /></div><div><h2 className="text-xl font-bold">إعدادات الذكاء الاصطناعي</h2><p className="text-sm text-muted-foreground">اختر مزوّد الـ AI والنموذج المستخدم في توليد القصص والمعلومات.</p></div></div>
      <div className="space-y-2"><Label className="font-bold">المزوّد</Label><Select value={provider} onValueChange={(v)=>{ const p=v as typeof provider; setProvider(p); const first=MODEL_PRESETS[p].models[0]; if(first) setModel(first.id); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MODEL_PRESETS).map(([k,v])=>(<SelectItem key={k} value={k}>{v.label}</SelectItem>))}</SelectContent></Select></div>
      <div className="space-y-2"><Label className="font-bold">النموذج</Label>{presets.models.length>0 ? (<Select value={model} onValueChange={setModel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{presets.models.map((m)=>(<SelectItem key={m.id} value={m.id}>{m.name} <span className="text-xs text-muted-foreground" dir="ltr">({m.id})</span></SelectItem>))}</SelectContent></Select>) : (<Input value={model} onChange={(e)=>setModel(e.target.value)} placeholder="model-id" dir="ltr" />)}</div>
      {provider==="custom" && (<div className="space-y-2"><Label className="font-bold">رابط الـ API الأساسي (OpenAI-compatible)</Label><Input value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" dir="ltr" /></div>)}
      {needsKey && (<div className={`p-4 rounded-2xl border-2 ${keyPresent ? "bg-primary/5 border-primary/30" : "bg-destructive/5 border-destructive/30"}`}><div className="flex items-start gap-3"><KeyRound className={`size-5 mt-0.5 ${keyPresent ? "text-primary" : "text-destructive"}`} /><div className="flex-1"><p className="font-bold mb-1">{keyPresent ? "✓ المفتاح مُعرَّف (CUSTOM_AI_API_KEY)" : "⚠️ المفتاح غير مُعرَّف"}</p><p className="text-xs text-muted-foreground leading-relaxed">المفتاح يُخزَّن بشكل آمن في الباك إند باسم <code className="text-xs bg-muted px-1 rounded">CUSTOM_AI_API_KEY</code>. {!keyPresent && " اطلب من مدير المشروع إضافته من إعدادات الأسرار."} لتحديثه لاحقاً يكفي تعديل قيمة نفس السر.</p></div></div></div>)}
      <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={saving} className="flex-1 min-w-[140px]">{saving ? <Loader2 className="size-4 animate-spin ml-2" /> : null} حفظ الإعدادات</Button><Button onClick={test} disabled={testing} variant="outline">{testing ? <Loader2 className="size-4 animate-spin ml-2" /> : null} اختبار الاتصال</Button></div>
      {testResult && (<div className={`p-3 rounded-xl text-sm flex items-start gap-2 ${testResult.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{testResult.ok ? <CheckCircle2 className="size-4 mt-0.5 shrink-0" /> : <XCircle className="size-4 mt-0.5 shrink-0" />}<span dir="ltr" className="break-all">{testResult.msg}</span></div>)}
    </Card>
  );
}
