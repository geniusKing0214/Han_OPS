import { redirect } from "next/navigation";

/** 가입은 Google 로그인 한 번으로 처리합니다. */
export default function SignupPage() {
  redirect("/login");
}
