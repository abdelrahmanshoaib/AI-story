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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Shield, Users, BookOpen, BookMarked, TrendingUp,
  Trash2, ArrowRight, ShieldCheck, ShieldOff, Search, KeyRound, Sparkles, CheckCircle2, XCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "لوحة تحكم الأدمن" },
      { name: "description", content: "إدارة المستخدمين والقصص والإحصائيات" },
    ],
  }),
});

function AdminPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
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

  const adminCheck = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => isAdminQuery(),
    enabled: authChecked,
  });

  const isAdminUser = adminCheck.data?.isAdmin === true;

  const stats = useQuery({ queryKey: ["adminStats"], queryFn: () => statsFn(), enabled: isAdminUser });
  const users = useQuery({ queryKey: ["adminUsers"], queryFn: () => usersFn(), enabled: isAdminUser });
  const stories = useQuery({ queryKey: ["adminStories"], queryFn: () => storiesFn(), enabled: isAdminUser });

  if (!authChecked || adminCheck.isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  if (!isAdminUser) {
    return (
      <main dir="rtl" className="min-h-screen grid place-items-center px-4">
        <Card className="p-8 text-center max-w-md space-y-4">
          <ShieldOff className="size-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">غير مسموح</h1>
          <p className="text-muted-foreground">هذه الصفحة متاحة للأدمن فقط.</p>
          <Button asChild><Link to="/"><ArrowRight className="size-4 ml-1" /> العودة للرئيسية</Link></Button>
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    }
  }

  async function removeStory(id: string) {
    if (!confirm("حذف هذه القصة نهائياً؟")) return;
    try {
      await delStoryFn({ data: { id } });
      toast.success("تم حذف القصة");
      qc.invalidateQueries({ queryKey: ["adminStories"] });
      qc.invalidateQueries({ queryKey: ["adminStats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
  }

  async function removeUser(user_id: string) {
    if (!confirm("حذف هذا المستخدم وجميع بياناته نهائياً؟")) return;
    try {
      await delUserFn({ data: { user_id } });
      toast.success("تم حذف المستخدم");
      qc.invalidateQueries({ queryKey: ["adminUsers"] });
      qc.invalidateQueries({ queryKey: ["adminStats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
  }

  const filteredUsers = (users.data ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q);
  });

  const s = stats.data;

  return (
    <main dir="rtl" className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8 gap-3">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-primary grid place-items-center shadow-md">
            <Shield className="size-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">لوحة تحكم الأدمن</h1>
            <p className="text-xs text-muted-foreground">إدارة كاملة للمنصة</p>
          </div>
        </div>
        <Button asChild variant="ghost"><Link to="/"><ArrowRight className="size-4 ml-1" /> الرئيسية</Link></Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard icon={Users} label="المستخدمون" value={s?.users} />
        <StatCard icon={ShieldCheck} label="أدمن" value={s?.admins} />
        <StatCard icon={BookOpen} label="إجمالي القصص" value={s?.stories} />
        <StatCard icon={TrendingUp} label="قصص اليوم" value={s?.storiesToday} />
        <StatCard icon={TrendingUp} label="قصص الشهر" value={s?.storiesThisMonth} />
        <StatCard icon={BookMarked} label="الكلمات" value={s?.vocabulary} />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
          <TabsTrigger value="stories">القصص</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالإيميل أو الاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            {users.isLoading ? (
              <div className="grid place-items-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right border-b">
                      <th className="py-2 px-2">المستخدم</th>
                      <th className="py-2 px-2">الإيميل</th>
                      <th className="py-2 px-2">الدور</th>
                      <th className="py-2 px-2">القصص</th>
                      <th className="py-2 px-2">تاريخ التسجيل</th>
                      <th className="py-2 px-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isAdm = u.roles.includes("admin");
                      return (
                        <tr key={u.user_id} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-2 flex items-center gap-2">
                            <div className="size-8 rounded-full overflow-hidden bg-muted shrink-0">
                              {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : null}
                            </div>
                            <span className="font-medium">{u.display_name ?? "—"}</span>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground" dir="ltr">{u.email}</td>
                          <td className="py-2 px-2">
                            {isAdm
                              ? <Badge>أدمن</Badge>
                              : <Badge variant="secondary">مستخدم</Badge>}
                          </td>
                          <td className="py-2 px-2">{u.stories_count}</td>
                          <td className="py-2 px-2 text-muted-foreground text-xs">
                            {new Date(u.created_at).toLocaleDateString("ar-EG")}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={isAdm ? "outline" : "default"}
                                onClick={() => toggleAdmin(u.user_id, isAdm)}
                              >
                                {isAdm ? <><ShieldOff className="size-3.5 ml-1" /> إلغاء أدمن</> : <><ShieldCheck className="size-3.5 ml-1" /> منح أدمن</>}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeUser(u.user_id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا يوجد مستخدمون</p>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="stories" className="mt-4">
          <Card className="p-4">
            {stories.isLoading ? (
              <div className="grid place-items-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right border-b">
                      <th className="py-2 px-2">العنوان</th>
                      <th className="py-2 px-2">الموضوع</th>
                      <th className="py-2 px-2">اللغة</th>
                      <th className="py-2 px-2">التاريخ</th>
                      <th className="py-2 px-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stories.data ?? []).map((st) => (
                      <tr key={st.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2 font-medium">
                          <Link to="/story/$id" params={{ id: st.id }} className="hover:underline">{st.title}</Link>
                        </td>
                        <td className="py-2 px-2">{st.topic}</td>
                        <td className="py-2 px-2">{st.language === "ar" ? "عربي" : "English"}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{new Date(st.created_at).toLocaleDateString("ar-EG")}</td>
                        <td className="py-2 px-2">
                          <Button size="sm" variant="destructive" onClick={() => removeStory(st.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(stories.data ?? []).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد قصص</p>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </main>
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
