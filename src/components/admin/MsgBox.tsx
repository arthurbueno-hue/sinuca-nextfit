import { Icon } from "../Icon";
import type { Msg } from "./useAction";

export function MsgBox({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div className={`alert ${msg.kind === "ok" ? "alert-ok" : "alert-error"}`} role="status">
      <Icon name={msg.kind === "ok" ? "check" : "alert"} />
      <span>{msg.text}</span>
    </div>
  );
}
