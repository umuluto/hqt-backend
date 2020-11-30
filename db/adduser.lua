if redis.call('hexists', KEYS[2], ARGV[2]) == 1 then
	return false
else
	redis.call('hset', KEYS[1], 'name', ARGV[2], 'pass', ARGV[3], 'salt', ARGV[4])  
	redis.call('hset', KEYS[2], ARGV[2], ARGV[1])
	return { ok = 'OK' }
end
