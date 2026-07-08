from django.db import models


class DatosDashboardGeorreferenciado(models.Model):
    numero_permiso = models.TextField(db_column='NumeroPermiso', primary_key=True)
    anio = models.IntegerField(db_column='Anio', null=True)
    tipo_periodo = models.TextField(db_column='TipoPeriodo', null=True)
    mes_ini = models.TextField(db_column='MesIni', null=True)
    mes_fin = models.TextField(db_column='MesFin', null=True)
    permisionario = models.TextField(db_column='Permisionario', null=True)
    modalidad = models.TextField(db_column='Modalidad', null=True)
    central_entidad_federativa = models.TextField(db_column='CentralEntidadFederativa', null=True)
    central_municipio = models.TextField(db_column='CentralMunicipio', null=True)
    total_capacidad = models.DecimalField(db_column='TotalCapacidad', max_digits=20, decimal_places=4, null=True)
    generacion_bruta = models.DecimalField(db_column='GeneracionBruta', max_digits=20, decimal_places=4, null=True)
    consumo_auxiliar = models.DecimalField(db_column='ConsumoAuxiliar', max_digits=20, decimal_places=4, null=True)
    generacion_neta = models.DecimalField(db_column='GeneracionNeta', max_digits=20, decimal_places=4, null=True)
    tecnologia_instalada = models.CharField(db_column='Tecnologia_Instalada', max_length=255, null=True)
    fuente_energia = models.CharField(db_column='Fuente_Energia', max_length=255, null=True)
    estatus_legal = models.CharField(db_column='Estatus_Legal', max_length=255, null=True)
    geom_texto = models.TextField(db_column='geom_texto', null=True)

    class Meta:
        managed = False
        db_table = '"electricidad"."datos_dashboard_georreferenciado"'
