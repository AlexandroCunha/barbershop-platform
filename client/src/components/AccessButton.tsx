import { useTenant } from "../tenant-context";

/** The top-right entry to the access page, where the owner and the barbers sign in. */
export function AccessButton() {
  const { slug } = useTenant();
  return (
    <a className="access-button" href={`/${slug}/acesso`}>
      Access
    </a>
  );
}
