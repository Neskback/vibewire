/*
# Endurecer escrituras de VibeWire Alfa

1. Cambios de permisos
- `news`: el navegador solo puede insertar campos editoriales; la propiedad, fechas y control interno quedan fuera de su alcance.
- `favorites`: el navegador solo puede insertar el identificador de la noticia; la cuenta se completa desde `auth.uid()`.
- `contact_messages`: el navegador solo puede insertar los datos que una persona escribe; propietario, estado y fecha quedan controlados por la base.

2. Seguridad
- Se mantienen las políticas RLS existentes.
- Se revocan privilegios de columnas de propiedad, auditoría y estado.
- Se conceden únicamente los campos necesarios para cada acción legítima.

3. Notas importantes
- No se eliminan tablas, filas ni columnas.
- Las operaciones existentes de la aplicación siguen funcionando con valores por defecto del servidor.
*/

REVOKE INSERT ON public.news FROM authenticated;
GRANT INSERT (title, category, description, content, image_url, featured, is_published) ON public.news TO authenticated;
REVOKE UPDATE ON public.news FROM authenticated;
GRANT UPDATE (title, category, description, content, image_url, featured, is_published) ON public.news TO authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.favorites FROM anon;
GRANT SELECT, DELETE ON public.favorites TO authenticated;
REVOKE INSERT, UPDATE ON public.favorites FROM authenticated;
GRANT INSERT (news_id) ON public.favorites TO authenticated;

REVOKE INSERT ON public.contact_messages FROM anon, authenticated;
GRANT INSERT (name, email, subject, message) ON public.contact_messages TO anon, authenticated;
