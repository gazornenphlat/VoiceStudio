import { AudioLinesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { appVersion } from '../bridge';
import { ThemeToggle } from './theme-toggle';

/**
 * Frameless-window title bar. Windows draws its caption buttons via
 * `titleBarOverlay` on the right (~140px); the padding keeps our content out
 * from under them.
 */
export function TopBar() {
  const { t } = useTranslation();
  return (
    <header
      className={cn(
        'app-drag flex h-9 shrink-0 items-center gap-3 border-b bg-(--toolbar-background) px-3 text-sidebar-foreground select-none',
        'pr-[140px]',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AudioLinesIcon className="size-4 text-primary" aria-hidden="true" />
        <span className="text-[13px] font-semibold tracking-tight">{t('app.name')}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {t('app.version', { version: appVersion() })}
        </span>
      </div>
      <span className="hidden min-w-0 flex-1 truncate text-[11px] text-muted-foreground sm:block">
        {t('app.tagline')}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
