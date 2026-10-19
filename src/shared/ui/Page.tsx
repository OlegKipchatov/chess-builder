import { BackButton } from "./BackButton.js";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
export const Page = ({
  id,
  title,
  children,
  back,
  actions,
  onBack,
  backLabel,
}: {
  id: string;
  title: string;
  children: ReactNode;
  back?: "/play" | "/profile" | "/history";
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) => {
  const navigate = useNavigate();
  return (
    <section
      id={id}
      className="tab"
      data-page-kind={back || onBack ? "subpage" : "root"}
    >
      <div className="page-header">
        {(back || onBack) && (
          <div className="page-header-start">
            <BackButton
              label={backLabel}
              onClick={
                onBack ||
                (() => {
                  if (back) void navigate({ to: back });
                })
              }
            />
          </div>
        )}
        <div className="page-header-content">
          <h1>{title}</h1>
        </div>
        {actions && <div className="page-header-end">{actions}</div>}
      </div>
      <div className="page-content">{children}</div>
    </section>
  );
};
export const Stat = ({ value, label }: { value: ReactNode; label: string }) => (
  <div className="stat-card">
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);
export const plural = (value: number, forms: [string, string, string]) =>
  forms[
    value % 100 >= 11 && value % 100 <= 14
      ? 2
      : value % 10 === 1
        ? 0
        : value % 10 >= 2 && value % 10 <= 4
          ? 1
          : 2
  ];
