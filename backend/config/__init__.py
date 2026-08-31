"""Initialize PyMySQL and allow MariaDB/MySQL versions compatibility for XAMPP & Linux."""

try:
    import pymysql  # type: ignore[import-untyped]

    pymysql.install_as_MySQLdb()
except ImportError:
    pass

# Patch Django BaseContext.__copy__ for Python 3.14 compatibility
# In Python 3.14+, copy.copy(super()) in BaseContext.__copy__ returns the super proxy object itself
# which lacks __dict__ and causes AttributeError ('super' object has no attribute 'dicts' / 'template').
try:
    from django.template import context as django_context

    def _python314_compat_base_context_copy(self):
        duplicate = self.__class__.__new__(self.__class__)
        duplicate.__dict__.update(self.__dict__)
        duplicate.dicts = self.dicts[:]
        return duplicate

    setattr(django_context.BaseContext, "__copy__", _python314_compat_base_context_copy)  # noqa: B010
except Exception:
    pass
