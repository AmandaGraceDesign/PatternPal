import { auth } from '@/lib/auth';
import PatternCanvas from '@/components/PatternCanvas';

export default async function PatternTesterPage() {
  const session = await auth();
  const isPro = session?.user?.isPro || false;
  
  return (
    <div className="h-screen overflow-hidden">
      <PatternCanvas isPro={isPro} />
    </div>
  );
}
