// مكتبة المواضيع التوعوية للأطفال — مصنّفة حسب الفئة
import {
  PawPrint, Bird, Waves, Rocket, HeartPulse, Lightbulb, Globe2, Star,
  BookOpen, Moon, Sparkles, Hand, Sun, Award, Users, Heart,
  type LucideIcon,
} from "lucide-react";

export type KidsTopic = {
  label: string;
  prompt: string;
  icon: LucideIcon;
};

export type KidsCategory = {
  id: string;
  title: string;
  emoji: string;
  topics: KidsTopic[];
};

export const KIDS_CATEGORIES: KidsCategory[] = [
  {
    id: "world",
    title: "اكتشف العالم",
    emoji: "🌍",
    topics: [
      { label: "الحيوانات", prompt: "معلومات ممتعة عن الحيوانات وعجائب خلق الله فيها", icon: PawPrint },
      { label: "الطيور", prompt: "عالم الطيور وأنواعها وكيف تطير", icon: Bird },
      { label: "البحار والمحيطات", prompt: "أسرار البحار وكائناتها العجيبة", icon: Waves },
      { label: "الفضاء والكواكب", prompt: "رحلة في الفضاء والنجوم والكواكب", icon: Rocket },
      { label: "جسم الإنسان", prompt: "كيف يعمل جسم الإنسان وعجائب خلقه", icon: HeartPulse },
      { label: "الاختراعات", prompt: "اختراعات مدهشة غيّرت حياتنا", icon: Lightbulb },
      { label: "الدول والثقافات", prompt: "تعرّف على دول العالم وثقافاتها", icon: Globe2 },
      { label: "معلومات ممتعة", prompt: "معلومة شيقة جديدة كل يوم", icon: Sparkles },
    ],
  },
  {
    id: "islamic",
    title: "القسم الإسلامي",
    emoji: "🕌",
    topics: [
      { label: "قصص الأنبياء", prompt: "قصة من قصص الأنبياء للأطفال", icon: BookOpen },
      { label: "قصص الصحابة", prompt: "قصة ملهمة من حياة الصحابة رضوان الله عليهم", icon: Star },
      { label: "العلماء المسلمين", prompt: "إنجاز عالم مسلم أفاد البشرية", icon: Award },
      { label: "الآداب الإسلامية", prompt: "أدب من آداب الإسلام للطفل", icon: Hand },
      { label: "الأذكار اليومية", prompt: "أذكار يحفظها الطفل ويعمل بها", icon: Moon },
      { label: "العادات الإسلامية اليومية", prompt: "عادة يومية يحبها الله لطفل مسلم", icon: Sun },
      { label: "قيم وأخلاق إسلامية", prompt: "قيمة إسلامية جميلة يتعلمها الطفل", icon: Heart },
      { label: "شخصيات إسلامية ملهمة", prompt: "شخصية إسلامية ملهمة للأطفال", icon: Users },
    ],
  },
  {
    id: "ethics",
    title: "الأخلاق والتربية",
    emoji: "💎",
    topics: [
      { label: "الصدق والأمانة", prompt: "الصدق والأمانة", icon: Star },
      { label: "بر الوالدين", prompt: "احترام الوالدين وبرّهما", icon: Heart },
      { label: "التعاون والرحمة", prompt: "التعاون والرحمة بين الأصدقاء", icon: Users },
      { label: "حسن الخلق", prompt: "حسن الخلق مع الناس", icon: Sparkles },
      { label: "النظافة", prompt: "النظافة من الإيمان", icon: Hand },
      { label: "الشجاعة", prompt: "الشجاعة في قول الحق", icon: Award },
    ],
  },
  {
    id: "stories",
    title: "قصص الأطفال",
    emoji: "📖",
    topics: [
      { label: "قصص قبل النوم", prompt: "قصة هادئة قبل النوم", icon: Moon },
      { label: "قصص تعليمية", prompt: "قصة تعليمية ممتعة", icon: BookOpen },
      { label: "قصص تربوية", prompt: "قصة تربوية بقيمة أخلاقية", icon: Heart },
      { label: "مهارات الأطفال", prompt: "مهارة حياتية مفيدة للطفل", icon: Lightbulb },
    ],
  },
];

export const AGE_GROUPS = [
  { id: "4-6", label: "4-6 سنوات", age: 5 },
  { id: "7-9", label: "7-9 سنوات", age: 8 },
  { id: "10-12", label: "10-12 سنة", age: 11 },
] as const;

export type AgeGroupId = (typeof AGE_GROUPS)[number]["id"];
