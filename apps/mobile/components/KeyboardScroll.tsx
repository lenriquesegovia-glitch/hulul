import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Dimensions, Keyboard, Platform, ScrollView, TextInput, type ScrollViewProps } from 'react-native';

/**
 * ScrollView que no deja que el teclado tape lo que se escribe.
 * En Android (pantalla de borde a borde) la ventana no se achica al abrir el
 * teclado: aquí se agrega espacio abajo del tamaño del teclado y se desplaza
 * la pantalla para que el campo activo quede visible encima del teclado.
 * Sirve para todas las pantallas con campos de texto (acceso, reservar, chat…).
 */
export function KeyboardScroll({ children, contentContainerStyle, onScroll, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const reveal = (kbHeight: number) => {
      const input = TextInput.State.currentlyFocusedInput?.();
      if (!input || !ref.current) return;
      // Espera a que se aplique el espacio extra y luego sube lo necesario.
      setTimeout(() => {
        input.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
          const visibleBottom = Dimensions.get('window').height - kbHeight - 16;
          const bottom = y + h;
          if (bottom > visibleBottom) ref.current?.scrollTo({ y: offset.current + (bottom - visibleBottom) + 8, animated: true });
          else if (y < 80) ref.current?.scrollTo({ y: Math.max(0, offset.current - (80 - y)), animated: true });
        });
      }, 60);
    };
    const show = Keyboard.addListener(showEvt, (e) => { const h = e.endCoordinates.height; setKb(h); reveal(h); });
    const hide = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={32}
      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; onScroll?.(e); }}
      contentContainerStyle={[contentContainerStyle, kb ? { paddingBottom: kb + 24 } : null]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
