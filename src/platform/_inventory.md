Platform adapters

- contacts.ts / contacts.native.ts: contacts capability and native contacts implementation.
- device.ts / device.native.ts: device identity/capability and native implementation.
- notifications.ts / notifications.native.ts: notification capability and native implementation.

Keep platform-specific suffix siblings together so Metro can resolve the appropriate implementation.
