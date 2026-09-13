from pathlib import Path

server = Path('server.ts')
server_text = server.read_text(encoding='utf-8')
dal = Path('server/dal.ts')
dal_text = dal.read_text(encoding='utf-8')

old_server = '''const CHECKIN_COOLDOWN_SECONDS = 60;\n'''
if old_server in server_text:
    server_text = server_text.replace(old_server, '', 1)

old_route = '''app.post('/api/places/:id/checkin', requireAuth, async (req, res, next) => {\n  try {\n    const { token } = requestUser(req);\n    const { data, error } = await getUserSupabaseClient(token).rpc('record_place_checkin', {\n      place_id_input: req.params.id,\n      cooldown_seconds: CHECKIN_COOLDOWN_SECONDS,\n    });\n    if (error) {\n      const message = String(error.message || '');\n      if (/check_in_rate_limited/i.test(message)) {\n        res.setHeader('Retry-After', String(CHECKIN_COOLDOWN_SECONDS));\n        return res.status(429).json({\n          error: 'Please wait before checking in to this place again',\n          retryAfterSeconds: CHECKIN_COOLDOWN_SECONDS,\n        });\n      }\n      if (/place not found/i.test(message)) return res.status(404).json({ error: 'Place not found' });\n      throwMappedSupabaseError(error);\n    }\n    res.json({ success: true, checkInsCount: Number(data || 0) });\n  } catch (error) {\n    next(error);\n  }\n});\n'''
new_route = '''app.post('/api/places/:id/checkin', requireAuth, async (req, res, next) => {\n  try {\n    const { token } = requestUser(req);\n    const result = await createDal(token).places.checkin(req.params.id);\n    res.json({ success: true, checkInsCount: result.checkInsCount });\n  } catch (error: any) {\n    const message = String(error?.message || '');\n    if (/check_in_rate_limited/i.test(message)) {\n      res.setHeader('Retry-After', '60');\n      return res.status(429).json({\n        error: 'Please wait before checking in to this place again',\n        retryAfterSeconds: 60,\n      });\n    }\n    if (/place not found/i.test(message)) return res.status(404).json({ error: 'Place not found' });\n    next(error);\n  }\n});\n'''
if server_text.count(old_route) != 1:
    raise RuntimeError(f'server check-in route match count={server_text.count(old_route)}')
server_text = server_text.replace(old_route, new_route, 1)

old_dal = '''      async checkin(placeId: string) {\n        const { data, error } = await getSupabaseAdmin().rpc('increment_place_checkins', { place_id_input: placeId });\n        if (error) throwMappedSupabaseError(error);\n        return { checkInsCount: data };\n      },\n'''
new_dal = '''      async checkin(placeId: string) {\n        const user = await verifyUser();\n        const { data, error } = await getSupabaseAdmin().rpc('record_place_checkin_server', {\n          p_user_id: user.id,\n          p_place_id: placeId,\n        });\n        if (error) throwMappedSupabaseError(error);\n        return { checkInsCount: Number(data || 0) };\n      },\n'''
if dal_text.count(old_dal) != 1:
    raise RuntimeError(f'DAL check-in match count={dal_text.count(old_dal)}')
dal_text = dal_text.replace(old_dal, new_dal, 1)

server.write_text(server_text, encoding='utf-8')
dal.write_text(dal_text, encoding='utf-8')
print('Applied final server-only check-in patch')
