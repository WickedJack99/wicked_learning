UPDATE public_pages
SET body = REPLACE(body, '\n', E'\n')
WHERE body LIKE '%\n%';
