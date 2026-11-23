import { type ClassForMember, formatJoinCode } from '@sabaq/shared';
import { Copy, Link2, QrCode, RefreshCw, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRegenerateJoinCode } from '../../api/classes';
import { useCurrentUser } from '../../auth/AuthProvider';
import { Button, Card, ConfirmDialog, Dialog, DialogContent } from '../../components/ui';
import { copyText } from '../../lib/clipboard';
import { allowed } from './helpers';

/** The link that opens the join page with the code filled in. */
export const joinLink = (code: string) =>
  `${window.location.origin}/join?code=${formatJoinCode(code)}`;

/** A QR code for the join link, drawn on demand (the encoder loads only when needed). */
function QrImage({ text, label }: { text: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void import('uqr').then(({ renderSVG }) => {
      if (active)
        setSvg(
          renderSVG(text, {
            border: 2,
            pixelSize: 8,
            whiteColor: '#ffffff',
            blackColor: '#000000',
          }),
        );
    });
    return () => {
      active = false;
    };
  }, [text]);
  if (!svg)
    return (
      <div
        aria-hidden="true"
        className="aspect-square w-full max-w-72 animate-pulse rounded-lg bg-surface-sunken"
      />
    );
  return (
    <img
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      alt={label}
      className="aspect-square w-full max-w-72 rounded-lg bg-white p-2"
    />
  );
}

/** Invite people: the code, a link, the device's share sheet and a QR code to scan in class. */
export function ShareCard({ cls }: { cls: ClassForMember }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const regenerate = useRegenerateJoinCode(cls.id);
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!cls.joinCode) return null;
  const code = formatJoinCode(cls.joinCode);
  const link = joinLink(cls.joinCode);
  const canShare = typeof navigator.share === 'function';

  const copy = async (text: string) => {
    if (await copyText(text)) toast.success(t('classes.share.copied'));
    else toast.error(t('classes.share.copyFailed'));
  };

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-text">{t('classes.share.title')}</h2>
        <p className="text-sm text-muted">{t('classes.share.body')}</p>
      </div>
      <p className="flex flex-col">
        <span className="text-sm font-semibold text-muted">{t('classes.share.code')}</span>
        <span
          dir="ltr"
          className="self-start font-mono text-3xl font-bold tracking-[0.2em] text-text select-all"
        >
          {code}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void copy(code)}>
          <Copy aria-hidden="true" />
          {t('classes.share.copyCode')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void copy(link)}>
          <Link2 aria-hidden="true" />
          {t('classes.share.copyLink')}
        </Button>
        {canShare && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void navigator
                .share({
                  title: cls.name,
                  text: t('classes.share.shareText', { name: cls.name, code }),
                  url: link,
                })
                .catch(() => undefined)
            }
          >
            <Share2 aria-hidden="true" />
            {t('classes.share.share')}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setQrOpen(true)}>
          <QrCode aria-hidden="true" />
          {t('classes.share.showQr')}
        </Button>
        {allowed(user, cls, 'class.regenerate_join_code') && (
          <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)}>
            <RefreshCw aria-hidden="true" />
            {t('classes.share.regenerate')}
          </Button>
        )}
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent
          title={t('classes.share.qrTitle', { name: cls.name })}
          description={t('classes.share.body')}
        >
          <div className="flex flex-col items-center gap-3">
            {qrOpen && <QrImage text={link} label={t('classes.share.qrAlt', { name: cls.name })} />}
            <span dir="ltr" className="font-mono text-2xl font-bold tracking-[0.2em] text-text">
              {code}
            </span>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('classes.share.regenerateTitle')}
        body={t('classes.share.regenerateBody')}
        confirmLabel={t('classes.share.regenerate')}
        pending={regenerate.isPending}
        onConfirm={() =>
          regenerate.mutate(undefined, {
            onSuccess: () => {
              setConfirmOpen(false);
              toast.success(t('classes.share.regenerated'));
            },
          })
        }
      />
    </Card>
  );
}
