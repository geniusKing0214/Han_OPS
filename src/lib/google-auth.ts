import { GoogleAuthProvider } from "firebase/auth";

/** Firebase Console → Authentication → Sign-in method → Google 사용 설정 필요 */
export const googleAuthProvider = new GoogleAuthProvider();

googleAuthProvider.setCustomParameters({
  prompt: "select_account",
});
