import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import Popup from '@enact/sandstone/Popup';
import $L from '@enact/i18n/$L';

import {useServerMessages} from '../../context/ServerMessagesContext';
import {MESSAGE_COLORS, hasAction, stripMarkdown} from '../../services/serverMessages';
import {parseMarkdown, markdownLinks} from '../../utils/markdown';
import {drawQrCode} from '../../utils/qrCanvas';
import {MessagesIcon} from '../icons/navIcons';
import MessageMarkdown from './MessageMarkdown';

import css from './ServerMessagesDialog.module.less';
import {appLocale} from '../../utils/appLocale';

const SpottableButton = Spottable('button');
const SpottableDiv = Spottable('div');

const cardId = (index) => `server-message-${index}`;
const QR_CLOSE_ID = 'server-message-qr-close';

const withAlpha = (hex, alpha) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const formatWhen = (iso) => {
	const date = new Date(iso);
	return `${date.toLocaleDateString(appLocale(), {year: 'numeric', month: 'short', day: 'numeric'})} ${date.toLocaleTimeString(appLocale(), {hour: 'numeric', minute: '2-digit'})}`;
};

// The link as a QR code for the viewer's phone, in place of the list.
const QrPanel = ({label, url, onClose}) => {
	const canvasRef = useRef(null);

	useEffect(() => {
		drawQrCode(canvasRef.current, url);
		const t = setTimeout(() => Spotlight.focus(QR_CLOSE_ID), 100);
		return () => clearTimeout(t);
	}, [url]);

	return (
		<div className={css.qrPanel}>
			<h2 className={css.title}>{label}</h2>
			<div className={css.hint}>{$L('Scan with your phone to open this link')}</div>
			<div className={css.qrContainer}>
				<canvas ref={canvasRef} className={css.qrCanvas} />
			</div>
			<div className={css.hint}>{url}</div>
			<div className={css.footer}>
				<SpottableButton className={css.button} onClick={onClose} spotlightId={QR_CLOSE_ID}>
					{$L('Close')}
				</SpottableButton>
			</div>
		</div>
	);
};

const MessageCard = ({message, index, read, expanded, onToggle, onOpenLink}) => {
	const [focused, setFocused] = useState(false);
	const color = MESSAGE_COLORS[message.color];
	const blocks = useMemo(() => (expanded ? parseMarkdown(message.body) : []), [expanded, message.body]);

	// The admin's button first, then any link written into the text. A TV has
	// nowhere to point a link, so each is offered under the message instead.
	const links = useMemo(() => {
		if (!expanded) return [];
		const list = hasAction(message) ? [{href: message.actionUrl, label: message.actionLabel}] : [];
		markdownLinks(blocks).forEach((link) => {
			if (!list.some((entry) => entry.href === link.href)) list.push(link);
		});
		return list;
	}, [expanded, message, blocks]);

	const handleToggle = useCallback(() => onToggle(message.id, index), [onToggle, message.id, index]);
	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	const handleLink = useCallback((e) => {
		const at = Number(e.currentTarget.dataset.link);
		onOpenLink(links[at], e.currentTarget.dataset.spotlightId);
	}, [onOpenLink, links]);

	return (
		<div className={css.card} style={{borderColor: withAlpha(color, focused ? 1 : 0.35)}}>
			<SpottableDiv
				className={css.cardBody}
				spotlightId={cardId(index)}
				onClick={handleToggle}
				onFocus={handleFocus}
				onBlur={handleBlur}
			>
				<MessagesIcon className={css.cardIcon} style={{fill: color}} />
				<div className={css.cardText}>
					<div className={css.cardTitleRow}>
						<span className={css.cardTitle}>{message.title || $L('Messages')}</span>
						{!read && <span className={css.unreadDot} style={{background: color}} />}
					</div>
					{message.createdUtc && <div className={css.cardDate}>{formatWhen(message.createdUtc)}</div>}
					{message.body && (expanded
						? <MessageMarkdown blocks={blocks} />
						: <div className={css.preview}>{stripMarkdown(message.body)}</div>
					)}
				</div>
			</SpottableDiv>
			{links.length > 0 && (
				<div className={css.cardActions}>
					{links.map((link, at) => (
						<SpottableButton
							key={link.href}
							className={css.button}
							spotlightId={`${cardId(index)}-link-${at}`}
							data-link={at}
							onClick={handleLink}
						>
							{link.label}
						</SpottableButton>
					))}
				</div>
			)}
		</div>
	);
};

// The window listing the messages the server admin sent. A card opens in place
// to show the whole message, and opening one counts as reading it.
const ServerMessagesDialog = ({open, onClose, backHandlerRef}) => {
	const {messages, unreadCount, isRead, markRead, markAllRead} = useServerMessages();
	const [expandedId, setExpandedId] = useState(null);
	const [qr, setQr] = useState(null);
	const returnFocusRef = useRef(null);

	useEffect(() => {
		if (!open) {
			setExpandedId(null);
			setQr(null);
			return;
		}
		const t = setTimeout(() => Spotlight.focus(messages.length ? cardId(0) : 'server-messages-close'), 100);
		return () => clearTimeout(t);
		// Focus only lands on open, not every time the list changes under it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// Back closes the QR code before it closes the window.
	useEffect(() => {
		if (!backHandlerRef) return;
		backHandlerRef.current = () => {
			if (!qr) return false;
			setQr(null);
			return true;
		};
		return () => {
			backHandlerRef.current = null;
		};
	}, [backHandlerRef, qr]);

	useEffect(() => {
		if (qr || !returnFocusRef.current) return;
		const id = returnFocusRef.current;
		returnFocusRef.current = null;
		const t = setTimeout(() => Spotlight.focus(id), 100);
		return () => clearTimeout(t);
	}, [qr]);

	const handleToggle = useCallback((id, index) => {
		if (expandedId === id) {
			// Closing takes the buttons away, so focus goes back to the card first
			// or it lands nowhere.
			Spotlight.focus(cardId(index));
			setExpandedId(null);
			return;
		}
		setExpandedId(id);
		markRead(id);
	}, [expandedId, markRead]);

	const handleOpenLink = useCallback((link, from) => {
		returnFocusRef.current = from;
		setQr({label: link.label, url: link.href});
	}, []);

	const handleCloseQr = useCallback(() => setQr(null), []);

	const handleMarkAllRead = useCallback(() => {
		// The button goes away with the last unread message.
		Spotlight.focus(cardId(0));
		markAllRead();
	}, [markAllRead]);

	if (!open) return null;

	return (
		<Popup
			open={open}
			onClose={onClose}
			position="center"
			scrimType="translucent"
			noAutoDismiss
			spotlightRestrict="self-only"
		>
			<div className={css.modal}>
				{qr ? (
					<QrPanel label={qr.label} url={qr.url} onClose={handleCloseQr} />
				) : (
					<>
						<div className={css.header}>
							<h2 className={css.title}>{$L('Messages')}</h2>
							<SpottableButton className={css.closeBtn} onClick={onClose} spotlightId="server-messages-close">
								<svg viewBox="0 0 24 24" fill="currentColor">
									<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
								</svg>
							</SpottableButton>
						</div>
						{messages.length === 0 ? (
							<div className={css.empty}>{$L('No messages from your server yet')}</div>
						) : (
							<div className={css.list}>
								{messages.map((message, index) => (
									<MessageCard
										key={message.id}
										message={message}
										index={index}
										read={isRead(message.id)}
										expanded={expandedId === message.id}
										onToggle={handleToggle}
										onOpenLink={handleOpenLink}
									/>
								))}
							</div>
						)}
						{unreadCount > 0 && (
							<div className={css.footer}>
								<SpottableButton className={css.button} onClick={handleMarkAllRead} spotlightId="server-messages-mark-all">
									{$L('Mark all as read')}
								</SpottableButton>
							</div>
						)}
					</>
				)}
			</div>
		</Popup>
	);
};

export default memo(ServerMessagesDialog);
