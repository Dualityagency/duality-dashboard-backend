import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : (exception as any)?.message ?? 'Internal server error';

    res.status(status).json({
      statusCode: status,
      message: typeof message === 'object' ? message : { error: message },
      timestamp: new Date().toISOString(),
    });
  }
}
