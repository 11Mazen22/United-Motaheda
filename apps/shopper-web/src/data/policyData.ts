export type PolicySeverity = 'low' | 'medium' | 'high' | 'critical';
export type PolicyCategory =
  | 'spam'
  | 'fraud'
  | 'harassment'
  | 'hate_speech'
  | 'illegal'
  | 'impersonation'
  | 'copyright'
  | 'security'
  | 'privacy'
  | 'malicious'
  | 'account_abuse'
  | 'payment_abuse'
  | 'terms';

export interface Policy {
  code: string;
  titleAr: string;
  titleEn: string;
  categoryAr: string;
  categoryEn: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  descriptionAr: string;
  descriptionEn: string;
  examplesAr: string[];
  examplesEn: string[];
  consequencesAr: string;
  consequencesEn: string;
  whyItMattersAr: string;
  whyItMattersEn: string;
  isAppealEligible: boolean;
  // English shorthand aliases — used by UI components that render English fallback
  title: string;
  description: string;
  examples: string[];
  consequences: string;
  whyItMatters: string;
  appealEligible: boolean;
}

type PolicyRaw = Omit<Policy, 'title' | 'description' | 'examples' | 'consequences' | 'whyItMatters' | 'appealEligible'>;

function withAliases(raw: PolicyRaw): Policy {
  return {
    ...raw,
    title: raw.titleEn,
    description: raw.descriptionEn,
    examples: raw.examplesEn,
    consequences: raw.consequencesEn,
    whyItMatters: raw.whyItMattersEn,
    appealEligible: raw.isAppealEligible,
  };
}

const RAW_POLICIES: PolicyRaw[] = [
  {
    code: 'POL-001',
    titleAr: 'الرسائل المزعجة والمراجعات الكاذبة',
    titleEn: 'Spam and Fake Reviews',
    categoryAr: 'البريد المزعج',
    categoryEn: 'Spam',
    category: 'spam',
    severity: 'medium',
    descriptionAr:
      'يُحظر إرسال رسائل متكررة وغير مرغوب فيها أو نشر مراجعات مزيفة أو مدفوعة لمنتجات الصيدلية. يشمل ذلك أي محتوى يُضلل المستخدمين أو يُؤثر على ثقتهم بنتائج البحث والتقييمات.',
    descriptionEn:
      'Sending repeated unwanted messages or posting fake, incentivized, or coordinated reviews for pharmacy products is prohibited. This includes any content that misleads users or artificially inflates product ratings.',
    examplesAr: [
      'إرسال نفس الرسالة الترويجية لأكثر من عشرة مستخدمين خلال ساعة واحدة',
      'نشر مراجعات إيجابية مزيفة مقابل خصومات أو هدايا',
      'استخدام حسابات متعددة لرفع تقييم منتج معين',
      'ملء حقول التعليقات بروابط خارجية غير ذات صلة',
    ],
    examplesEn: [
      'Sending the same promotional message to more than ten users within one hour',
      'Posting fake positive reviews in exchange for discounts or gifts',
      'Using multiple accounts to artificially boost a product rating',
      'Flooding comment fields with unrelated external links',
    ],
    consequencesAr:
      'تحذير رسمي للمخالفة الأولى، تعليق الحساب لمدة أسبوع للمخالفة الثانية، وحظر دائم للمخالفة الثالثة.',
    consequencesEn:
      'Formal warning for the first violation, one-week suspension for the second, and permanent ban for the third.',
    whyItMattersAr:
      'تدمر الرسائل المزعجة والمراجعات الكاذبة ثقة المرضى في منصتنا وتؤثر سلباً على قرارات الرعاية الصحية.',
    whyItMattersEn:
      'Spam and fake reviews erode patient trust and can negatively influence healthcare decisions made through our platform.',
    isAppealEligible: true,
  },
  {
    code: 'POL-002',
    titleAr: 'الاحتيال وسرقة الهوية المالية',
    titleEn: 'Fraud and Payment Deception',
    categoryAr: 'الاحتيال',
    categoryEn: 'Fraud',
    category: 'fraud',
    severity: 'critical',
    descriptionAr:
      'يُحظر تقديم طلبات وهمية أو استخدام بيانات دفع مسروقة أو التلاعب بأسعار المنتجات أو انتزاع استرداد غير مستحق للأموال من خلال ادعاءات كاذبة.',
    descriptionEn:
      'Placing fraudulent orders, using stolen payment credentials, manipulating product pricing, or obtaining undeserved refunds through false claims is strictly prohibited.',
    examplesAr: [
      'استخدام بطاقة ائتمانية مسروقة لإتمام عملية شراء',
      'الادعاء بعدم استلام طلب سليم بهدف الحصول على استرداد مزدوج',
      'إنشاء حسابات وهمية للاستفادة من عروض العملاء الجدد بشكل متكرر',
      'التلاعب بأكواد الخصم أو إساءة استخدام كوبونات الولاء',
    ],
    examplesEn: [
      'Using a stolen credit card to complete a purchase',
      'Claiming a valid order was not received to obtain a duplicate refund',
      'Creating fake accounts repeatedly to exploit new-customer promotions',
      'Manipulating discount codes or abusing loyalty coupons',
    ],
    consequencesAr:
      'تعليق فوري للحساب مع إحالة القضية إلى الجهات القانونية المختصة. لا يحق تقديم طعن في حالات الاحتيال الموثقة.',
    consequencesEn:
      'Immediate account suspension with referral to relevant legal authorities. No appeal is permitted in documented fraud cases.',
    whyItMattersAr:
      'الاحتيال يرفع التكاليف على جميع العملاء ويضر بالصيدليات الشريكة التي تعتمد على إيراداتها لتقديم الرعاية الصحية.',
    whyItMattersEn:
      'Fraud raises costs for all customers and harms partner pharmacies that rely on their revenue to provide healthcare services.',
    isAppealEligible: false,
  },
  {
    code: 'POL-003',
    titleAr: 'التحرش والتهديد',
    titleEn: 'Harassment and Threatening Behavior',
    categoryAr: 'التحرش',
    categoryEn: 'Harassment',
    category: 'harassment',
    severity: 'high',
    descriptionAr:
      'يُحظر توجيه أي شكل من أشكال التحرش أو التهديد أو الإزعاج المتعمد نحو المستخدمين الآخرين أو موظفي الصيدلية أو فريق دعم العملاء.',
    descriptionEn:
      'Any form of harassment, threats, intimidation, or deliberate distress directed at other users, pharmacy staff, or customer support representatives is prohibited.',
    examplesAr: [
      'إرسال رسائل تهديدية لموظف توصيل بسبب تأخر في الشحن',
      'مضايقة مستخدم آخر بشكل متكرر عبر نظام المراسلة',
      'نشر تعليقات مسيئة أو مهينة في قسم المراجعات',
      'التواصل المتكرر مع الدعم الفني بنية الإزعاج لا الاستفسار',
    ],
    examplesEn: [
      'Sending threatening messages to a delivery driver due to a shipping delay',
      'Repeatedly harassing another user through the messaging system',
      'Posting abusive or degrading comments in the reviews section',
      'Repeatedly contacting support with the intent to harass rather than seek help',
    ],
    consequencesAr:
      'تعليق الحساب فوراً لمدة لا تقل عن شهر، مع احتمال الحظر الدائم في حالات التهديد الجسيمة.',
    consequencesEn:
      'Immediate account suspension for a minimum of one month, with potential permanent ban for severe threats.',
    whyItMattersAr:
      'بيئة آمنة وإيجابية ضرورة أساسية لبناء الثقة بين المرضى ومقدمي الرعاية الصحية على منصتنا.',
    whyItMattersEn:
      'A safe and respectful environment is essential to building trust between patients and healthcare providers on our platform.',
    isAppealEligible: true,
  },
  {
    code: 'POL-004',
    titleAr: 'خطاب الكراهية والتمييز',
    titleEn: 'Hate Speech and Discrimination',
    categoryAr: 'خطاب الكراهية',
    categoryEn: 'Hate Speech',
    category: 'hate_speech',
    severity: 'critical',
    descriptionAr:
      'يُحظر نشر أي محتوى يروج للكراهية أو التحقير بسبب الدين أو العرق أو الجنس أو الإعاقة أو الجنسية أو أي وضع محمي آخر.',
    descriptionEn:
      'Publishing any content that promotes hatred, dehumanization, or discrimination based on religion, race, gender, disability, nationality, or any other protected characteristic is strictly prohibited.',
    examplesAr: [
      'استخدام ألقاب عنصرية أو طائفية في التعليقات أو الرسائل',
      'نشر محتوى يحرض على الكراهية ضد فئة دينية محددة',
      'التمييز ضد مستخدم بسبب إعاقته في نقاشات المنتجات',
      'استخدام صور أو رموز تدل على التعصب في صورة الملف الشخصي',
    ],
    examplesEn: [
      'Using racial or sectarian slurs in comments or messages',
      'Posting content inciting hatred against a specific religious group',
      'Discriminating against a user because of their disability in product discussions',
      'Using images or symbols associated with bigotry in a profile picture',
    ],
    consequencesAr:
      'حظر دائم وفوري للحساب دون إمكانية الاستئناف في الحالات الموثقة بوضوح.',
    consequencesEn:
      'Immediate and permanent account ban with no possibility of appeal in clearly documented cases.',
    whyItMattersAr:
      'نؤمن بأن الرعاية الصحية حق للجميع بصرف النظر عن هويتهم، ونرفض أي خطاب يقوّض هذا المبدأ.',
    whyItMattersEn:
      'We believe healthcare is a right for everyone regardless of their identity and will not tolerate speech that undermines this principle.',
    isAppealEligible: false,
  },
  {
    code: 'POL-005',
    titleAr: 'الأنشطة غير المشروعة والمواد المحظورة',
    titleEn: 'Illegal Activities and Controlled Substances',
    categoryAr: 'الأنشطة غير المشروعة',
    categoryEn: 'Illegal Activities',
    category: 'illegal',
    severity: 'critical',
    descriptionAr:
      'يُحظر طلب أو محاولة شراء المواد الخاضعة للرقابة دون وصفة طبية سارية، أو بيع الأدوية أو تداولها خارج القنوات المرخصة، أو توظيف المنصة لأي غرض غير مشروع.',
    descriptionEn:
      'Ordering or attempting to purchase controlled substances without a valid prescription, selling or trading medications outside licensed channels, or using the platform for any illegal purpose is prohibited.',
    examplesAr: [
      'طلب دواء مخدر أو مؤثر عقلياً دون إرفاق وصفة طبية معتمدة',
      'محاولة شراء مستحضرات تجميلية طبية محظور بيعها للمستهلك المباشر',
      'استخدام المنصة كوسيط لإعادة بيع الأدوية خارج نطاق الترخيص',
      'تقديم وصفات طبية مزورة أو مُعدَّلة',
    ],
    examplesEn: [
      'Ordering a narcotic or psychotropic medication without attaching a valid prescription',
      'Attempting to purchase medical cosmetics whose direct sale to consumers is prohibited',
      'Using the platform as an intermediary to resell medications outside licensing scope',
      'Submitting forged or altered prescriptions',
    ],
    consequencesAr:
      'حظر فوري ودائم وإبلاغ السلطات المختصة وفق القانون.',
    consequencesEn:
      'Immediate permanent ban and mandatory reporting to the appropriate authorities as required by law.',
    whyItMattersAr:
      'سلامة المرضى وسلامة المجتمع مبدأ لا تنازل عنه؛ تداول الأدوية المحظورة يُعرض الأرواح للخطر.',
    whyItMattersEn:
      'Patient and community safety is non-negotiable; the circulation of prohibited drugs puts lives at risk.',
    isAppealEligible: false,
  },
  {
    code: 'POL-006',
    titleAr: 'انتحال الهوية الطبية',
    titleEn: 'Medical Impersonation',
    categoryAr: 'انتحال الهوية',
    categoryEn: 'Impersonation',
    category: 'impersonation',
    severity: 'critical',
    descriptionAr:
      'يُحظر ادعاء كون المستخدم طبيباً أو صيدلانياً أو أي متخصص طبي مرخص لغرض الحصول على أدوية أو تقديم مشورات طبية أو التحايل على أنظمة الرقابة.',
    descriptionEn:
      'Claiming to be a licensed doctor, pharmacist, or any medical professional in order to obtain medications, provide medical advice, or circumvent regulatory controls is strictly prohibited.',
    examplesAr: [
      'ادعاء كون المستخدم طبيباً لطلب أدوية تستلزم الوصفة الطبية',
      'انتحال هوية صيدلاني لإسداء نصائح دوائية للمرضى',
      'استخدام شهادة علمية مزورة للتحقق من الهوية المهنية',
      'التظاهر بأنك تنتمي إلى فريق المنصة الطبي للحصول على امتيازات خاصة',
    ],
    examplesEn: [
      'Claiming to be a doctor in order to request prescription-only medications',
      'Impersonating a pharmacist to offer drug advice to patients',
      'Using a forged academic credential to verify a professional identity',
      'Pretending to belong to the platform medical team to obtain special privileges',
    ],
    consequencesAr:
      'حظر دائم فوري وإبلاغ الجهات الصحية والقانونية المختصة.',
    consequencesEn:
      'Immediate permanent ban and referral to relevant health and legal authorities.',
    whyItMattersAr:
      'انتحال الهوية الطبية يُشكل خطراً مباشراً على صحة المرضى ويُقوض النظام الصحي بأكمله.',
    whyItMattersEn:
      'Medical impersonation poses a direct danger to patient health and undermines the entire healthcare system.',
    isAppealEligible: false,
  },
  {
    code: 'POL-007',
    titleAr: 'انتهاك حقوق الملكية الفكرية',
    titleEn: 'Copyright and Intellectual Property Violation',
    categoryAr: 'حقوق الملكية الفكرية',
    categoryEn: 'Copyright',
    category: 'copyright',
    severity: 'medium',
    descriptionAr:
      'يُحظر نشر أو استخدام محتوى يخضع لحقوق الملكية الفكرية دون الحصول على إذن صريح من مالكه، بما في ذلك الصور والنصوص والشعارات الخاصة بالعلامات التجارية للأدوية.',
    descriptionEn:
      'Publishing or using content protected by intellectual property rights without explicit permission from the rights holder is prohibited, including images, texts, and brand logos associated with pharmaceutical trademarks.',
    examplesAr: [
      'نسخ وصف المنتج من موقع شركة دواء دون إذن',
      'استخدام شعار علامة تجارية دوائية في مراجعة المنتج دون ترخيص',
      'نشر صور طبية أو مخططات بيانية من كتب أكاديمية محمية',
      'إعادة نشر مقالات طبية مقننة دون الإشارة إلى المصدر أو الحصول على الإذن',
    ],
    examplesEn: [
      'Copying a product description from a pharmaceutical company website without permission',
      'Using a pharmaceutical brand logo in a product review without a license',
      'Publishing medical images or charts from protected academic textbooks',
      'Republishing copyrighted medical articles without attribution or permission',
    ],
    consequencesAr:
      'إزالة المحتوى المنتهك فوراً، وتحذير رسمي، وتعليق مؤقت عند التكرار.',
    consequencesEn:
      'Immediate removal of the infringing content, formal warning, and temporary suspension upon repeat.',
    whyItMattersAr:
      'حماية الملكية الفكرية تُشجع الابتكار الدوائي وتصون حقوق المبدعين والعلماء.',
    whyItMattersEn:
      'Protecting intellectual property encourages pharmaceutical innovation and safeguards the rights of creators and scientists.',
    isAppealEligible: true,
  },
  {
    code: 'POL-008',
    titleAr: 'إساءة استخدام الأنظمة الأمنية',
    titleEn: 'Security Abuse and Unauthorized Access',
    categoryAr: 'إساءة أمنية',
    categoryEn: 'Security',
    category: 'security',
    severity: 'critical',
    descriptionAr:
      'يُحظر اختراق أو محاولة اختراق أنظمة المنصة أو استغلال الثغرات الأمنية أو تنفيذ هجمات حشو بيانات الاعتماد أو أي نشاط يهدد أمن البنية التحتية الرقمية.',
    descriptionEn:
      'Breaching or attempting to breach platform systems, exploiting security vulnerabilities, executing credential stuffing attacks, or any activity that threatens digital infrastructure security is strictly prohibited.',
    examplesAr: [
      'محاولة تسجيل دخول آلي بقوائم كلمات مرور مسربة',
      'استغلال ثغرة في واجهة برمجة التطبيقات للحصول على بيانات مستخدمين آخرين',
      'تشغيل برامج مسح آلي لاستخلاص قاعدة بيانات المنتجات',
      'حقن كود خبيث في حقول الإدخال بالمنصة',
    ],
    examplesEn: [
      'Attempting automated login using leaked password lists',
      'Exploiting an API vulnerability to access other users\' data',
      'Running automated scraping scripts to extract the product database',
      'Injecting malicious code into platform input fields',
    ],
    consequencesAr:
      'حظر فوري ودائم وإبلاغ الجهات الأمنية والقانونية المختصة.',
    consequencesEn:
      'Immediate permanent ban and reporting to relevant security and legal authorities.',
    whyItMattersAr:
      'يحمي النظام الأمني بيانات صحة المرضى الحساسة وهو التزام قانوني وأخلاقي لا تنازل عنه.',
    whyItMattersEn:
      'Security systems protect sensitive patient health data and represent a non-negotiable legal and ethical obligation.',
    isAppealEligible: false,
  },
  {
    code: 'POL-009',
    titleAr: 'انتهاك خصوصية المستخدمين',
    titleEn: 'User Privacy Violation',
    categoryAr: 'انتهاك الخصوصية',
    categoryEn: 'Privacy',
    category: 'privacy',
    severity: 'high',
    descriptionAr:
      'يُحظر مشاركة أو الكشف عن البيانات الشخصية أو المعلومات الصحية الخاصة بمستخدمين آخرين دون موافقتهم الصريحة.',
    descriptionEn:
      'Sharing or disclosing the personal data or private health information of other users without their explicit consent is prohibited.',
    examplesAr: [
      'نشر عنوان أو رقم هاتف مستخدم آخر في المنتديات أو التعليقات',
      'الكشف عن السجل الدوائي لشخص آخر في مراجعة عامة',
      'مشاركة لقطات شاشة تحتوي على بيانات طلبات مستخدمين في مجموعات خارجية',
      'البحث عن معلومات مستخدم آخر وإعادة نشرها بهدف الإضرار به',
    ],
    examplesEn: [
      'Posting another user\'s address or phone number in forums or comments',
      'Revealing someone else\'s medication history in a public review',
      'Sharing screenshots of other users\' order data in external groups',
      'Researching and republishing another user\'s information to harm them',
    ],
    consequencesAr:
      'تعليق الحساب لمدة لا تقل عن ثلاثة أشهر، وحظر دائم عند التكرار.',
    consequencesEn:
      'Account suspension for a minimum of three months, and permanent ban upon repeat.',
    whyItMattersAr:
      'البيانات الصحية من أكثر المعلومات حساسية، وانتهاك خصوصيتها يُلحق أضراراً بالغة ومضاعفات قانونية جسيمة.',
    whyItMattersEn:
      'Health data is among the most sensitive information; violating its privacy causes serious harm and significant legal consequences.',
    isAppealEligible: true,
  },
  {
    code: 'POL-010',
    titleAr: 'نشر المعلومات الطبية الكاذبة والمُضللة',
    titleEn: 'Medical Misinformation',
    categoryAr: 'المحتوى الخبيث',
    categoryEn: 'Malicious Content',
    category: 'malicious',
    severity: 'high',
    descriptionAr:
      'يُحظر نشر أو ترويج معلومات طبية مزيفة أو غير مدعومة علمياً تتعلق بالأدوية أو العلاجات أو الجرعات أو التفاعلات الدوائية بما قد يُعرض صحة المرضى للخطر.',
    descriptionEn:
      'Publishing or promoting false or scientifically unsupported medical information related to medications, treatments, dosages, or drug interactions in a way that may endanger patient health is prohibited.',
    examplesAr: [
      'نشر تعليق يدّعي أن دواءً معيناً يعالج مرضاً دون أي أساس علمي',
      'التحذير من تأثيرات جانبية مخترعة لدواء بهدف الإضرار بصانعه',
      'تقديم نصائح حول تعديل الجرعات دون مؤهل طبي',
      'الترويج لعلاجات بديلة غير مثبتة بوصفها بديلاً عن الأدوية الموصوفة',
    ],
    examplesEn: [
      'Posting a comment claiming a specific drug treats a disease without any scientific basis',
      'Warning about invented side effects of a medication to harm its manufacturer',
      'Offering dosage modification advice without medical qualifications',
      'Promoting unproven alternative treatments as substitutes for prescribed medications',
    ],
    consequencesAr:
      'إزالة المحتوى الفوري، وتحذير رسمي للمخالفة الأولى، وتعليق الحساب عند التكرار.',
    consequencesEn:
      'Immediate content removal, formal warning for a first violation, and account suspension upon repeat.',
    whyItMattersAr:
      'قرارات الدواء مسألة حياة أو موت؛ نحن مسؤولون عن دقة كل معلومة تنتشر عبر منصتنا.',
    whyItMattersEn:
      'Medication decisions are a matter of life and death; we are responsible for the accuracy of every piece of information that circulates through our platform.',
    isAppealEligible: true,
  },
  {
    code: 'POL-011',
    titleAr: 'إساءة استخدام الحسابات والتحايل على الحظر',
    titleEn: 'Account Abuse and Ban Evasion',
    categoryAr: 'إساءة استخدام الحساب',
    categoryEn: 'Account Abuse',
    category: 'account_abuse',
    severity: 'high',
    descriptionAr:
      'يُحظر إنشاء حسابات متعددة للتحايل على العقوبات أو للاستفادة بصورة غير مشروعة من العروض والخصومات، أو محاولة استعادة الوصول إلى حساب موقوف.',
    descriptionEn:
      'Creating multiple accounts to evade penalties, unfairly exploit offers and discounts, or attempt to regain access to a suspended account is prohibited.',
    examplesAr: [
      'إنشاء حساب جديد بعد تعليق الحساب الأصلي للتحايل على الحظر',
      'استخدام عناوين بريد إلكتروني متعددة للاستفادة من عرض الترحيب أكثر من مرة',
      'تشارك بيانات الحساب مع أشخاص آخرين لاستغلال امتيازات العضوية',
      'التلاعب بإعدادات الجهاز أو عنوان IP للتهرب من قيود الحساب',
    ],
    examplesEn: [
      'Creating a new account after the original is suspended to evade the ban',
      'Using multiple email addresses to benefit from a welcome offer more than once',
      'Sharing account credentials with others to exploit membership privileges',
      'Manipulating device settings or IP address to evade account restrictions',
    ],
    consequencesAr:
      'حظر دائم لجميع الحسابات المرتبطة، وحجب دائم لبيانات الجهاز عند التكرار.',
    consequencesEn:
      'Permanent ban on all associated accounts, and permanent device-level block upon repeat.',
    whyItMattersAr:
      'نزاهة المنصة تعتمد على هويات حقيقية وموثوقة لضمان جودة الخدمة لجميع المستخدمين.',
    whyItMattersEn:
      'Platform integrity depends on authentic, verifiable identities to ensure service quality for all users.',
    isAppealEligible: false,
  },
  {
    code: 'POL-012',
    titleAr: 'الاحتيال في المدفوعات والاسترداد',
    titleEn: 'Payment and Refund Abuse',
    categoryAr: 'إساءة الدفع',
    categoryEn: 'Payment Abuse',
    category: 'payment_abuse',
    severity: 'high',
    descriptionAr:
      'يُحظر الإفراط في طلبات استرداد الأموال القائمة على ادعاءات كاذبة، وإلغاء المدفوعات عبر بنك بطاقة الائتمان بعد استلام البضاعة (الرد على المشتريات)، وأي سلوك يستغل سياسات الاسترداد لتحقيق مكاسب مالية غير مشروعة.',
    descriptionEn:
      'Excessive refund requests based on false claims, initiating chargebacks after receiving goods, and any behavior that exploits refund policies for illicit financial gain is prohibited.',
    examplesAr: [
      'طلب استرداد مبلغ بحجة عدم وصول الطلب مع استلامه فعلياً',
      'تقديم طلب رد عبر البنك دون التواصل مع خدمة العملاء أولاً',
      'استغلال ضمان الإرجاع لإعادة أدوية بعد استخدامها',
      'نمط متكرر من الاسترداد دون سبب مشروع',
    ],
    examplesEn: [
      'Requesting a refund claiming an order was not received while it was actually delivered',
      'Filing a bank chargeback without first contacting customer service',
      'Exploiting the return guarantee to return medications after using them',
      'A repeated pattern of refunds without legitimate reason',
    ],
    consequencesAr:
      'تعليق الحساب لمدة شهر للمخالفة الأولى، وحظر دائم عند تكرار السلوك مع احتمال اتخاذ إجراءات قانونية.',
    consequencesEn:
      'One-month suspension for the first violation, and permanent ban upon repeat with potential legal action.',
    whyItMattersAr:
      'الاحتيال في الاسترداد يُثقل كاهل الصيدليات الشريكة ويرفع التكاليف على العملاء الشرفاء.',
    whyItMattersEn:
      'Refund fraud burdens partner pharmacies and raises costs for honest customers.',
    isAppealEligible: true,
  },
  {
    code: 'POL-013',
    titleAr: 'انتهاك شروط الخدمة العامة',
    titleEn: 'General Terms of Service Violation',
    categoryAr: 'شروط الخدمة',
    categoryEn: 'Terms of Service',
    category: 'terms',
    severity: 'low',
    descriptionAr:
      'يشمل هذا البند أي انتهاك لشروط استخدام المنصة لا تغطيه السياسات المحددة أعلاه، بما في ذلك انتهاك قواعد السلوك العام أو سوء استخدام ميزات المنصة.',
    descriptionEn:
      'This covers any breach of platform terms of use not addressed by the specific policies above, including violating general conduct rules or misusing platform features.',
    examplesAr: [
      'استخدام المنصة لأغراض تجارية غير مرخصة خارج نطاق الاستخدام الشخصي',
      'محاولة إعادة بيع منتجات مشتراة عبر المنصة بهامح ربح',
      'تقديم معلومات شخصية غير دقيقة عند إنشاء الحساب',
      'التشهير بخدمات المنصة بصورة مبالغ فيها وغير صادقة',
    ],
    examplesEn: [
      'Using the platform for unlicensed commercial purposes outside personal use',
      'Attempting to resell products purchased through the platform at a markup',
      'Providing inaccurate personal information during account creation',
      'Defaming platform services in an exaggerated and dishonest manner',
    ],
    consequencesAr:
      'تحذير رسمي للمخالفة الأولى، وتدرج في العقوبات وصولاً إلى التعليق الدائم.',
    consequencesEn:
      'Formal warning for the first violation, with escalating penalties up to permanent suspension.',
    whyItMattersAr:
      'الشروط العامة تضمن بيئة عادلة ومحترمة لجميع مستخدمي المنصة وشركائها.',
    whyItMattersEn:
      'General terms ensure a fair and respectful environment for all platform users and partners.',
    isAppealEligible: true,
  },
];

export const POLICIES: Policy[] = RAW_POLICIES.map(withAliases);

export function getPolicyByCode(code: string): Policy | undefined {
  return POLICIES.find((p) => p.code === code);
}

export function getPoliciesByCategory(category: PolicyCategory): Policy[] {
  return POLICIES.filter((p) => p.category === category);
}

export function getPoliciesBySeverity(severity: PolicySeverity): Policy[] {
  return POLICIES.filter((p) => p.severity === severity);
}
