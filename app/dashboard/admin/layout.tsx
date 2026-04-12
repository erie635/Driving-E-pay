import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) redirect("/login");

  try {
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );
    // TEMP: allow access for testing
    if (!decodedToken) {
      redirect("/login");
    }
    return <>{children}</>;
  } catch {
    redirect("/login");
  }
}
