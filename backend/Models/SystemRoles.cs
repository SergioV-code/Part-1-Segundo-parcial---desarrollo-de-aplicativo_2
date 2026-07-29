namespace EDUMETRICS_DR.Models;

public static class SystemRoles
{
    public const string Estudiante = "Estudiante";
    public const string AnalistaMinerd = "Analista MINERD";
    public const string AnalistaMescyt = "Analista MESCYT";

    public const string SoloAnalistas = AnalistaMinerd + "," + AnalistaMescyt;
}
