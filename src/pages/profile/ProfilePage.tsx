import { usePgnImportDialog } from "../../features/game-review/PgnImportDialog.js";
import { useNavigate } from "@tanstack/react-router";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { usePwaUpdate } from "../../app/providers/PwaProvider.js";
import { useTheme } from "../../app/providers/ThemeProvider.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import { Page, Stat } from "../../shared/ui/Page.js";
export const ProfilePage = () => {
  const openPgn = usePgnImportDialog();
  const played = useVault((s) => s.played),
    owned = useVault((s) => s.owned.length),
    opened = useVault((s) => s.opened),
    { theme, setTheme } = useTheme(),
    pwa = usePwaUpdate(),
    navigate = useNavigate(),
    { show } = useOverlays();
  return (
    <Page id="profile" title="Профиль">
      <p className="page-supporting">
        Ваш прогресс хранится на этом устройстве
      </p>
      <div className="profile-stats">
        <Stat label="Сыграно партий" value={played} />
        <Stat label="Предметов в коллекции" value={owned} />
        <Stat label="Открыто сундуков" value={opened} />
      </div>
      <div className="profile-links">
        <button
          className="quiet wide"
          onClick={() => void navigate({ to: "/history" })}
        >
          История партий
        </button>
        <button
          className="quiet wide"
          onClick={() => void navigate({ to: "/statistics" })}
        >
          Статистика
        </button>
        <button className="quiet wide" onClick={openPgn}>
          Открыть PGN
        </button>
      </div>
      <div className="theme-setting">
        <label htmlFor="theme-preference">Тема</label>
        <select
          id="theme-preference"
          value={theme}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "light" || value === "dark" || value === "system")
              setTheme(value);
          }}
        >
          <option value="system">Системная</option>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
        </select>
      </div>
      <div className="profile-secondary-links">
        {pwa.available && (
          <button
            className="primary wide"
            disabled={pwa.updating}
            onClick={pwa.update}
          >
            Обновить приложение
          </button>
        )}
        <button
          className="quiet wide"
          onClick={() => {
            if (pwa.canInstall) void pwa.install();
            else
              show({
                title: "Установить приложение",
                body: (
                  <p>
                    Откройте меню браузера и выберите «Установить приложение»
                    или «На экран Домой». После полной загрузки приложение
                    доступно без интернета.
                  </p>
                ),
              });
          }}
        >
          Установить приложение
        </button>
        <button
          className="quiet wide"
          onClick={() => void navigate({ to: "/faq" })}
        >
          Вопросы и ответы
        </button>
      </div>
      {pwa.error && <p role="alert">{pwa.error}</p>}
    </Page>
  );
};
export default ProfilePage;
